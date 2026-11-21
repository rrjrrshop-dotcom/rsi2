import {readFile, rename, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {attachSecurityMetadata} from '../server/scan-metadata.mjs';
import {resultStore} from '../server/result-store.mjs';
import {redisSettings} from '../server/redis-rest.mjs';
import {marketCache, MARKET_HISTORY_LENGTH, pricesThrough, dividendsThrough} from '../server/market-cache.mjs';
import {collectionTarget, easternDate, tradingDatesFromBars, tradingWeekdays} from '../server/trading-calendar.mjs';
import {makeMarketData} from '../server/market-data.mjs';
import {intradayContext, compareFrames} from '../intraday1000.mjs';
import {scanHistories} from '../server/grouped-scan.mjs';
import {rateLimit} from '../server/batch-scan.mjs';
import {daysBefore, MAX_FUNDAMENTALS_AGE_DAYS} from '../server/sec-fundamentals.mjs';
import {loadQuotelinksFundamentals} from '../server/quotelinks-fundamentals.mjs';
import {screenRecommendations,sharesAtClose,passesFinancialScreen} from '../server/recommendation-screen.mjs';
import {indexRecommendationUniverse} from '../server/index-constituents.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_SCOPES} from '../recommendation-policy.mjs';

export async function readSession(cache, client, date, now) {
  const saved = await cache.session(date);
  if (saved) return saved;
  const rows = await client.dailyMarket(date, {adjusted: false});
  if (!rows.length && date === easternDate(now)) {
    console.log(`No confirmed bars for ${date} at the first collection time`);
    return {rows};
  }
  if (rows.length && !rows.some(row => row.symbol === 'SPY' && Number.isFinite(row.close) && row.close > 0)) {
    throw Error(`${date} 일봉에서 기준 종목의 확정 종가를 확인할 수 없습니다.`);
  }
  const session = {receivedAt: new Date().toISOString(), rows};
  await cache.saveSession(date, session);
  console.log(rows.length ? `Stored grouped close ${date}: ${rows.length} instruments` : `No trading session on ${date}`);
  return session;
}

function addBars(history, date, rows) {
  const seen = new Set();
  for (const row of rows) {
    const entry = history.get(row.symbol);
    if (!entry) continue;
    if (seen.has(row.symbol)) throw Error(`${date} 중복 종목 ${row.symbol}`);
    seen.add(row.symbol);
    if (!Number.isFinite(row.close) || row.close <= 0) throw Error(`${date} 종가 형식 오류 ${row.symbol}`);
    const {open, high, low, close, volume} = row;
    entry.bars.push({date, open, high, low, close, volume});
  }
}

function rankingCounts(preliminary) {
  return Object.fromEntries(Object.entries(RECOMMENDATION_SCOPES).map(([key, {list}]) => [
    key, Object.fromEntries(Object.entries(preliminary[list]).map(([tab, rows]) => [tab, rows.length])),
  ]));
}

async function main() {
  const [universePath = 'universe.json', datesPath = 'auto', outputPath = 'scan-result.json'] = process.argv.slice(2);
  const universe = JSON.parse(await readFile(universePath, 'utf8'));
  if (!universe.complete || !Array.isArray(universe.securities)) throw Error('Universe is incomplete');
  const now = new Date();
  const available = collectionTarget(now);
  const forcedDates = datesPath === 'auto' ? null : JSON.parse(await readFile(datesPath, 'utf8'));
  if (forcedDates && (!Array.isArray(forcedDates) || !forcedDates.length ||
      forcedDates.some((date, i) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || (i && date <= forcedDates[i - 1]) || date > available))) {
    throw Error('거래일은 수집 시간이 지난 날짜를 오름차순으로 지정하세요.');
  }
  const target = forcedDates?.at(-1) ?? available;
  const settings = redisSettings();
  const cache = marketCache(settings);
  const previous = await cache.current();
  if (previous && previous.through >= target) {
    console.log(`Confirmed close ${previous.through} already published`);
    return;
  }

  const abort = new AbortController();
  const limitedFetch = rateLimit((url, options) => {
    abort.signal.throwIfAborted();
    return fetch(url, {...options, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)])});
  }, {intervalMs: 13000});
  const client = makeMarketData({key: process.env.MASSIVE_API_KEY, maxRetries: 2, fetcher: limitedFetch});
  let sessions;
  let dates;
  let receivedAt;
  if (!previous) {
    const calendar = forcedDates ?? tradingDatesFromBars(await client.daily('SPY', daysBefore(target, 550), target), {asOf: target});
    dates = calendar.slice(-MARKET_HISTORY_LENGTH);
    const date = dates.at(-1);
    const session = await readSession(cache, client, date, now);
    if (!session.rows.length) throw Error('초기 종가 저장본에 확정 거래일이 필요합니다.');
    sessions = new Map([[date, session.rows]]);
    receivedAt = session.receivedAt;
  } else {
    sessions = new Map();
    for (const date of tradingWeekdays(previous.through, target)) {
      const session = await readSession(cache, client, date, now);
      if (!session.rows.length) continue;
      sessions.set(date, session.rows);
      receivedAt = session.receivedAt;
    }
    if (!sessions.size) return;
    dates = [...previous.dates, ...sessions.keys()].slice(-MARKET_HISTORY_LENGTH);
  }
  const through = dates.at(-1);
  const historyFrom = dates[0];
  const indexed = indexRecommendationUniverse(universe.securities);
  const [directory, prepared] = await Promise.all([client.stockDirectory(through, {allTypes: true}), cache.prepared(through)]);
  const companyDirectory = directory.filter(({type}) => type === 'CS');
  const listed = companyDirectory.filter(row => /^[A-Z0-9]{4}$/.test(row.exchange ?? '') && row.exchange !== 'OOTC')
    .map(({ticker, name}) => ({symbol: ticker, name, kind: 'stock'}));
  if (!listed.length || new Set(directory.map(row => row.ticker)).size !== directory.length) {
    throw Error('기준일 미국 거래소 종목 목록을 확인할 수 없습니다.');
  }
  console.log(`US exchange-listed common stocks: ${listed.length}`);
  const securities = [...new Map([...listed, ...indexed.securities].map(item => [item.symbol, item])).values()];
  const fundamentals = loadQuotelinksFundamentals(securities, through, {
    directory: companyDirectory, signal: abort.signal,
    onProgress: ({completed, total}) => {
      if (completed % 100 === 0 || completed === total) console.log(`Financial reports: ${completed}/${total}`);
    },
  });
  const splitsTask = client.splits([historyFrom, daysBefore(through, MAX_FUNDAMENTALS_AGE_DAYS)].sort()[0], through);
  async function stageHistory() {
    if (prepared) {
      console.log(`Reuse prepared ${through} market data`);
      return {meta: prepared, history: await cache.histories(prepared)};
    }
    const dividendsTask = client.dividends(historyFrom, through, {includeCashAmount: true});
    async function collect() {
      const old = previous ? await cache.histories(previous) : new Map();
      const history = new Map(directory.map(({ticker, name, type}) => [ticker, {
        name, type, bars: (old.get(ticker)?.bars ?? []).filter(bar => bar.date >= historyFrom),
      }]));
      for (const {symbol, name} of universe.securities) {
        if (!history.has(symbol)) history.set(symbol, {name, bars: (old.get(symbol)?.bars ?? []).filter(bar => bar.date >= historyFrom)});
      }
      const missing = previous ? [...sessions.keys()] : dates;
      for (const [index, date] of missing.entries()) {
        abort.signal.throwIfAborted();
        const rows = sessions.get(date) ?? await client.dailyMarket(date, {adjusted: false});
        if (!rows.length) throw Error(`${date} 일봉 데이터가 비어 있습니다.`);
        addBars(history, date, rows);
        if (!previous && (index % 25 === 0 || index === missing.length - 1)) {
          console.log(`Initial history ${index + 1}/${missing.length} ${date}`);
        }
      }
      return history;
    }
    const [history, splits, dividends] = await Promise.all([collect(), splitsTask, dividendsTask]);
    for (const [symbol, record] of history) {
      record.splits = splits.get(symbol);
      record.dividends = dividends.get(symbol);
    }
    const meta = await cache.stage({dates, history, receivedAt});
    console.log(`Prepared saved prices: ${meta.symbols} symbols, ${dates.length} sessions, ${Math.round(meta.bytes / 1024 / 1024)} MiB`);
    return {meta, history};
  }

  let preparedMarket, facts, splits;
  try {
    [preparedMarket, facts, splits] = await Promise.all([stageHistory(), fundamentals, splitsTask]);
  } catch (error) {
    abort.abort(error);
    throw error;
  }
  const {meta, history} = preparedMarket;
  const closes = new Map(sessions.get(through).map(row => [row.symbol, row.close]));
  const screens = Object.fromEntries(Object.entries(RECOMMENDATION_SCOPES).map(([key, {id, excludedFraction}]) => {
    const subset = key === 'major' ? indexed.securities : listed;
    const screen = screenRecommendations(subset, facts, closes, splits, through, excludedFraction);
    Object.assign(screen.summary, {source: 'SEC EDGAR via Quotelinks', scope: id});
    if (screen.summary.status !== 'applied') throw Error(`${id} 시가총액·재무 기준을 확인할 수 없습니다.`);
    console.log('Recommendation screen:', JSON.stringify(screen.summary));
    return [key, screen];
  }));
  const selected = new Set([...universe.securities.map(row => row.symbol), ...screens.all.eligible]);
  const adjusted = new Map();
  const dividends = new Map();
  for (const symbol of selected) {
    const record = history.get(symbol);
    if (!record) continue;
    adjusted.set(symbol, pricesThrough(record, through));
    dividends.set(symbol, dividendsThrough(record, through));
  }
  const result = scanHistories({
    symbols: universe.securities.map(row => row.symbol), dates: meta.dates, history: adjusted, dividends,
    major: screens.major.eligible, all: screens.all.eligible,
    recommendationMembership: new Map(indexed.securities.map(({symbol, indexes}) => [symbol, indexes])),
  });
  result.preliminary.recommendationScreen = {...screens.major.summary, indexCounts: indexed.counts,
    indexSymbols: indexed.securities.length, indexSources: universe.indexSources};
  result.preliminary.marketRecommendationScreen = screens.all.summary;
  console.log('Recommendation counts:', JSON.stringify(rankingCounts(result.preliminary)));

  const frameContexts = {};
  const candidates = Object.values(RECOMMENDATION_SCOPES).flatMap(({list}) => result.preliminary[list]['1000']);
  const comparisons = new Map();
  for (const candidate of candidates) {
    if (!comparisons.has(candidate.symbol)) {
      try {
        const bars = await client.fifteenMinute(candidate.symbol, daysBefore(through, 7), through);
        const frame = intradayContext(bars, through);
        frameContexts[candidate.symbol] = frame;
        comparisons.set(candidate.symbol, {...compareFrames(candidate.dailyFrame, frame), through, method: frame.method});
      } catch (error) {
        comparisons.set(candidate.symbol, {status: 'unavailable', label: '15분봉 비교 불가', through});
        console.error(`${candidate.symbol}: 15분봉 확인 실패 (${error.message})`);
      }
    }
    candidate.frameComparison = comparisons.get(candidate.symbol);
    delete candidate.dailyFrame;
  }
  const finalResult = {...attachSecurityMetadata(result, universe.securities), createdAt: new Date().toISOString()};
  finalResult.companyProfiles=Object.fromEntries(directory.map(company=>{
    const data=facts.get(company.ticker), shares=sharesAtClose(data?.shares,splits.get(company.ticker)??[],through);
    const cap=shares*closes.get(company.ticker);
    return [company.ticker,{name:company.name,marketCap:Number.isFinite(cap)&&cap>0?cap:null,
      financials:data?.balance?(passesFinancialScreen(data.balance)?'재무 기준 통과':'재무 기준 미달'):'자료 부족',
      indexes:indexed.securities.find(item=>item.symbol===company.ticker)?.indexes??[],through}];
  }));
  await cache.publish(meta, finalResult, frameContexts, previous);
  const [stored, saved] = await Promise.all([cache.current(), resultStore(settings).load()]);
  if (stored?.generation !== meta.generation || saved?.createdAt !== finalResult.createdAt ||
      !Object.keys(RECOMMENDATION_SCOPES).every(scope => hasCurrentRecommendationScreen(saved, scope))) {
    throw Error('저장된 종가와 추천 결과의 기준일을 재확인할 수 없습니다.');
  }
  const testRecord = await cache.record(stored, 'SPY');
  if (testRecord?.bars.at(-1)?.date !== through) throw Error('기준 종목 일봉을 다시 읽을 수 없습니다.');
  const tmp = `${outputPath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(finalResult, null, 2));
  await rename(tmp, outputPath);
  console.log(`Published and read back ${through}: ${stored.symbols} ticker histories`);
  console.log('Saved recommendation counts:', JSON.stringify(rankingCounts(saved.preliminary)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1});
}
