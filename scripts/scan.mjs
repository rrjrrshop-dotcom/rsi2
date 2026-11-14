import {readFile, rename, writeFile} from 'node:fs/promises';
import {attachSecurityMetadata} from '../server/scan-metadata.mjs';
import {resultStore} from '../server/result-store.mjs';
import {tradingDatesFromBars} from '../server/trading-calendar.mjs';
import {priorEasternDay} from '../api/quote.mjs';
import {makeMarketData} from '../server/market-data.mjs';
import {intradayContext, compareFrames} from '../intraday1000.mjs';
import {scanGrouped} from '../server/grouped-scan.mjs';
import {snapshotStore, withSnapshotCache} from '../server/snapshot-store.mjs';
import {rateLimit} from '../server/batch-scan.mjs';
import {daysBefore, MAX_FUNDAMENTALS_AGE_DAYS} from '../server/sec-fundamentals.mjs';
import {loadQuotelinksFundamentals} from '../server/quotelinks-fundamentals.mjs';
import {screenRecommendations} from '../server/recommendation-screen.mjs';
import {indexRecommendationUniverse} from '../server/index-constituents.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_SCOPES} from '../recommendation-policy.mjs';

async function prepareRecommendations(client, directory, candidates, through, signal) {
  const securities = [...new Map([...candidates.all, ...candidates.major].map(item => [item.symbol, item])).values()];
  const [fundamentals, closingBars, splits] = await Promise.all([
    loadQuotelinksFundamentals(securities, through, {directory, signal, onProgress: ({completed, total}) => {
      if (completed % 100 === 0 || completed === total) console.log(`Financial reports: ${completed}/${total}`);
    }}),
    client.dailyMarket(through, {adjusted: false}),
    client.splits(daysBefore(through, MAX_FUNDAMENTALS_AGE_DAYS), through),
  ]);
  if (!closingBars.length) throw Error('시가총액 기준일의 종가 데이터가 없습니다.');
  const closes = new Map(closingBars.map(row => [row.symbol, row.close]));
  return Object.fromEntries(Object.entries(RECOMMENDATION_SCOPES).map(([key, {id, excludedFraction}]) => {
    const screen = screenRecommendations(candidates[key], fundamentals, closes, splits, through, excludedFraction);
    Object.assign(screen.summary, {source: 'SEC EDGAR via Quotelinks', scope: id});
    if (screen.summary.status !== 'applied') throw Error(`${id} 시가총액과 재무건전성을 확인할 자료가 부족합니다.`);
    console.log('Recommendation screen:', JSON.stringify(screen.summary));
    return [key, screen];
  }));
}

function recommendationCounts(preliminary) {
  return Object.fromEntries(Object.entries(RECOMMENDATION_SCOPES).map(([key, {list}]) => [
    key, Object.fromEntries(Object.entries(preliminary[list]).map(([tab, rows]) => [tab, rows.length])),
  ]));
}

async function main() {
  const [universePath, datesPath, outputPath = 'scan-result.json'] = process.argv.slice(2);
  if (!universePath || !datesPath) throw Error('Usage: node scripts/scan.mjs universe.json trading-dates.json [output.json]');
  const universe = JSON.parse(await readFile(universePath, 'utf8'));
  if (!universe.complete || !Array.isArray(universe.securities)) throw Error('Universe is incomplete: do not report this scan as complete');
  const abort = new AbortController();
  const limitedFetch = rateLimit((url, options) => {
    abort.signal.throwIfAborted();
    return fetch(url, {...options, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)])});
  }, {intervalMs: 13000});
  const client = makeMarketData({key: process.env.MASSIVE_API_KEY, maxRetries: 2, fetcher: limitedFetch});
  const lastDate = priorEasternDay();
  const dates = datesPath === 'auto'
    ? tradingDatesFromBars(await client.daily('SPY', daysBefore(lastDate, 550), lastDate), {asOf: lastDate}).slice(-350)
    : JSON.parse(await readFile(datesPath, 'utf8'));
  if (!Array.isArray(dates) || !dates.length) throw Error('확정 거래일이 없습니다.');
  const through = dates.at(-1);
  // Split-adjusted historical values may change after a corporate action.
  const getDaily = withSnapshotCache(snapshotStore(`.rsi-cache/${through}`), date => client.dailyMarket(date));

  const indexed = indexRecommendationUniverse(universe.securities);
  const directory = await client.stockDirectory(through);
  const listed = directory.filter(row => /^[A-Z0-9]{4}$/.test(row.exchange ?? '') && row.exchange !== 'OOTC')
    .map(({ticker, name}) => ({symbol: ticker, name, kind: 'stock'}));
  if (!listed.length || new Set(listed.map(row => row.symbol)).size !== listed.length) {
    throw Error('기준일 거래소 상장 보통주 목록이 비어 있거나 중복되었습니다.');
  }
  console.log(`US exchange-listed common stocks: ${listed.length}`);
  const screens = prepareRecommendations(client, directory, {major: indexed.securities, all: listed}, through, abort.signal);
  const breakoutDividends = client.dividends(dates[0], through);
  const scan = scanGrouped({
    symbols: universe.securities.map(row => row.symbol), dates,
    getDaily: date => {
      abort.signal.throwIfAborted();
      return getDaily(date);
    },
    marketSymbols: listed.map(row => row.symbol),
    recommendationMembership: new Map(indexed.securities.map(({symbol, indexes}) => [symbol, indexes])),
    getRecommendationCandidates: async () => {
      const {major, all} = await screens;
      return {major: major.eligible, all: all.eligible};
    },
    getBreakoutDividends: () => breakoutDividends,
    onProgress: ({completed, total, date}) => console.error(`${completed}/${total} ${date}`),
  });
  let result, screened;
  try {
    [result, screened] = await Promise.all([scan, screens, breakoutDividends]);
  } catch (error) {
    abort.abort(error);
    throw error;
  }
  result.preliminary.recommendationScreen = {...screened.major.summary, indexCounts: indexed.counts,
    indexSymbols: indexed.securities.length, indexSources: universe.indexSources};
  result.preliminary.marketRecommendationScreen = screened.all.summary;
  console.log(`Breakout entries excluded because cash dividends could not be verified: ${result.preliminary.breakoutAdjustmentErrors}`);
  console.log('Recommendation counts:', JSON.stringify(recommendationCounts(result.preliminary)));

  // The two rankings may share a ticker. Compare it against the same daily frame once.
  const candidates = Object.values(RECOMMENDATION_SCOPES).flatMap(({list}) => result.preliminary[list]['1000']);
  const frames = new Map();
  for (const candidate of candidates) {
    if (!frames.has(candidate.symbol)) {
      try {
        const bars = await client.fifteenMinute(candidate.symbol, daysBefore(through, 7), through);
        const frame = intradayContext(bars, through);
        frames.set(candidate.symbol, {...compareFrames(candidate.dailyFrame, frame), through, method: frame.method});
      } catch (error) {
        frames.set(candidate.symbol, {status: 'unavailable', label: '15분봉 비교 불가', through});
        console.error(`${candidate.symbol}: 15분봉 확인 실패 (${error.message})`);
      }
    }
    candidate.frameComparison = frames.get(candidate.symbol);
    delete candidate.dailyFrame;
  }
  const finalResult = {...attachSecurityMetadata(result, universe.securities), createdAt: new Date().toISOString()};
  const tmp = `${outputPath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(finalResult, null, 2));
  await rename(tmp, outputPath);
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const store = resultStore({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
    await store.save(finalResult);
    const saved = await store.load();
    if (saved?.createdAt !== finalResult.createdAt || !Object.keys(RECOMMENDATION_SCOPES).every(scope => hasCurrentRecommendationScreen(saved, scope))) {
      throw Error('저장된 추천 결과의 범위와 기준일을 확인할 수 없습니다.');
    }
    console.log('Saved recommendation counts:', JSON.stringify(recommendationCounts(saved.preliminary)));
  }
  console.log(`Complete: ${result.total} symbols, ${result.buy.length} buy, ${result.stale.length} stale`);
}
main().catch(error => {console.error(error.message); process.exitCode = 1});
