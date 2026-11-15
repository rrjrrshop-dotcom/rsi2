import {randomUUID} from 'node:crypto';
import {gzipSync, gunzipSync} from 'node:zlib';
import {redisRest, redisSettings} from './redis-rest.mjs';
import {compactScan, RESULT_KEY} from './result-store.mjs';

export const MARKET_HISTORY_LENGTH = 350;
export const SAVED_MARKET_SOURCE = 'Massive · 일일 저장본';
const keyPrefix = 'rsi2:market:v1:';
const currentKey = keyPrefix + 'current';
const shardCount = 96;
const stageLifetime = 8 * 3600;
const closeLifetime = 7 * 86400;
const bytesLimit = 100 * 1024 * 1024;
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
const encode = value => gzipSync(JSON.stringify(value), {level: 4}).toString('base64');
const decode = value => JSON.parse(gunzipSync(Buffer.from(value, 'base64')).toString());
const dataKey = (generation, shard) => keyPrefix + 'data:' + generation + ':' + shard;
const preparedKey = date => keyPrefix + 'prepared:' + date;
const sessionKey = date => keyPrefix + 'close:' + date;
const frameKey = generation => keyPrefix + 'frames:' + generation;
const shardFor = symbol => {
  let hash = 0;
  for (const char of symbol) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash % shardCount;
};

function readMeta(value) {
  if (value == null) return null;
  const meta = JSON.parse(value);
  if (!/^[a-f0-9-]{36}$/.test(meta.generation) || !validDate(meta.through) ||
      !Array.isArray(meta.dates) || meta.dates.at(-1) !== meta.through ||
      meta.dates.some((date, i) => !validDate(date) || (i && date <= meta.dates[i - 1]))) {
    throw Error('저장된 종가의 기준일을 확인할 수 없습니다.');
  }
  return meta;
}

function unpack(value, dates) {
  const {b, n, t, s, d} = decode(value);
  const bars = b.map(([day, open, high, low, close, volume]) => ({date: dates[day], open, high, low, close, volume}));
  return {bars, name: n, type: t, splits: s ?? [], dividends: d ?? []};
}

async function runShards(task) {
  const workers = await Promise.allSettled(Array.from({length: 4}, async (_, worker) => {
    for (let index = worker; index < shardCount; index += 4) await task(index);
  }));
  const failed = workers.find(worker => worker.status === 'rejected');
  if (failed) throw failed.reason;
}

export function marketCache(settings = redisSettings()) {
  const {command, transaction} = redisRest(settings);
  return {
    async current() { return readMeta(await command(['GET', currentKey])); },
    async prepared(date) { return readMeta(await command(['GET', preparedKey(date)])); },
    async session(date) {
      const value = await command(['GET', sessionKey(date)]);
      return value ? decode(value) : null;
    },
    async saveSession(date, session) {
      await command(['SET', sessionKey(date), encode(session), 'EX', closeLifetime]);
    },
    async record(meta, symbol) {
      const value = await command(['HGET', dataKey(meta.generation, shardFor(symbol)), symbol]);
      return value ? unpack(value, meta.dates) : null;
    },
    async histories(meta) {
      const history = new Map();
      await runShards(async index => {
        const rows = await command(['HGETALL', dataKey(meta.generation, index)]);
        if (!Array.isArray(rows) || rows.length % 2) throw Error('저장된 일봉을 읽을 수 없습니다.');
        for (let i = 0; i < rows.length; i += 2) history.set(rows[i], unpack(rows[i + 1], meta.dates));
      });
      if (history.size !== meta.symbols) throw Error('저장된 일봉의 종목 수가 일치하지 않습니다.');
      return history;
    },
    async frames(meta) {
      const value = await command(['GET', frameKey(meta.generation)]);
      return value ? JSON.parse(value) : {};
    },
    async stage({dates, history, receivedAt}) {
      const generation = randomUUID();
      const dateIndex = new Map(dates.map((date, index) => [date, index]));
      const shards = Array.from({length: shardCount}, () => []);
      let bytes = 0;
      for (const [symbol, row] of history) {
        const value = encode({
          b: row.bars.map(({date, open, high, low, close, volume}) => [dateIndex.get(date), open, high, low, close, volume]),
          n: row.name, t: row.type, s: row.splits, d: row.dividends,
        });
        shards[shardFor(symbol)].push(symbol, value);
        bytes += Buffer.byteLength(value) + Buffer.byteLength(symbol);
      }
      if (bytes > bytesLimit) throw Error('일봉 저장 크기가 한도를 초과했습니다.');
      try {
        await runShards(async index => {
          if (!shards[index].length) return;
          const key = dataKey(generation, index);
          await transaction([['HSET', key, ...shards[index]], ['EXPIRE', key, stageLifetime]]);
        });
        const meta = {generation, dates, through: dates.at(-1), receivedAt, symbols: history.size, bytes};
        await command(['SET', preparedKey(meta.through), JSON.stringify(meta), 'EX', stageLifetime]);
        return meta;
      } catch (error) {
        await command(['DEL', ...shards.map((_, index) => dataKey(generation, index))]).catch(() => {});
        throw error;
      }
    },
    async publish(meta, result, frames, previous) {
      if (result.expectedDate !== meta.through || (previous && previous.through >= meta.through)) {
        throw Error('종가와 추천 목록의 게시 순서를 확인하세요.');
      }
      const commands = Array.from({length: shardCount}, (_, index) => ['PERSIST', dataKey(meta.generation, index)]);
      if (previous) {
        for (let index = 0; index < shardCount; index++) commands.push(['EXPIRE', dataKey(previous.generation, index), 1800]);
        commands.push(['EXPIRE', frameKey(previous.generation), 1800]);
      }
      const compact = compactScan({...result, marketReceivedAt: meta.receivedAt});
      commands.push(['SET', frameKey(meta.generation), JSON.stringify(frames)],
        ['SET', RESULT_KEY, JSON.stringify(compact)], ['SET', currentKey, JSON.stringify(meta)], ['DEL', preparedKey(meta.through)]);
      await transaction(commands);
    },
  };
}

/** Apply only splits effective on or before the requested session. */
export function pricesThrough(record, through) {
  const bars = record.bars.filter(bar => bar.date <= through);
  const splits = (record.splits ?? []).filter(split => split.date <= through);
  if (!splits.some(split => split.date > bars[0]?.date)) return bars;
  let shareRatio = 1;
  return bars.reverse().map(bar => {
    while (splits.length && splits.at(-1).date > bar.date) {
      const split = splits.pop();
      shareRatio *= split.to / split.from;
    }
    if (shareRatio === 1) return bar;
    return {...bar, open: bar.open / shareRatio, high: bar.high / shareRatio, low: bar.low / shareRatio,
      close: bar.close / shareRatio, volume: Number.isFinite(bar.volume) ? bar.volume * shareRatio : bar.volume};
  }).reverse();
}

export function dividendsThrough(record, through) {
  return (record.dividends ?? []).filter(event => event.date < through).map(event => {
    if (!Number.isFinite(event.cashAmount)) return event;
    const shareRatio = (record.splits ?? []).reduce((ratio, split) =>
      split.date > event.date && split.date <= through ? ratio * split.to / split.from : ratio, 1);
    return {...event, amount: event.cashAmount / shareRatio};
  });
}
