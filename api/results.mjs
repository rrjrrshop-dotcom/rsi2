import {easternDate, dataAgeDays} from '../server/trading-calendar.mjs';
import {constantTimeEqual} from '../server/subscriptions.mjs';
import {marketCache, pricesThrough, dividendsThrough} from '../server/market-cache.mjs';
import {adjustBreakoutBars, BREAKOUT_ADJUSTMENT} from '../breakout.mjs';
import {scoreStrategy} from '../scores.mjs';
import {resultStore} from '../server/result-store.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_SCOPES} from '../recommendation-policy.mjs';

const lists = {'1000':'thousand', trend:'trend', box:'box', rsi2:'buy', breakout:'breakout'};
const pageSize = 12;

async function scoredResults(result, strategy, page, res) {
  const store = marketCache();
  const meta = await store.current();
  if (meta?.through !== result.expectedDate) {
    return res.status(409).json({error:'검색 결과를 갱신 중입니다. 잠시 후 다시 불러오세요.'});
  }
  const source = strategy === 'rsi2' ? result.buy : result.preliminary?.[lists[strategy]];
  const candidates = (source ?? []).filter(row => row.date === meta.through);
  const rows = await Promise.all(candidates.slice(page*pageSize,(page+1)*pageSize).map(async ({symbol}) => {
    const record = await store.record(meta,symbol);
    if (record?.bars.at(-1)?.date !== meta.through) return {symbol};
    let bars = pricesThrough(record,meta.through);
    try {
      if (strategy === 'breakout') bars = adjustBreakoutBars(bars,dividendsThrough(record,meta.through));
      return {symbol,date:meta.through,...scoreStrategy(strategy,bars,symbol),
        ...(strategy === 'breakout' && {adjustment:BREAKOUT_ADJUSTMENT})};
    } catch {
      return {symbol};
    }
  }));
  return res.status(200).json({rows,expectedDate:meta.through,page,pages:Math.ceil(candidates.length/pageSize),total:candidates.length,
    staleWarning:dataAgeDays(meta.through,easternDate())>7});
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'GET 요청만 지원합니다.'});
  if (!process.env.PAIRING_SECRET || !constantTimeEqual(req.headers.authorization || '', `Bearer ${process.env.PAIRING_SECRET}`)) {
    return res.status(401).json({error: '등록 코드가 올바르지 않습니다.'});
  }
  const strategy = req.query?.strategy;
  const page = Number(req.query?.page ?? 0);
  if (strategy !== undefined && (typeof strategy !== 'string' || !Object.hasOwn(lists,strategy) ||
      !Number.isSafeInteger(page) || page<0)) {
    return res.status(400).json({error:'전략 또는 페이지를 확인하세요.'});
  }
  try {
    const store = resultStore({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
    const result = await store.load();
    if (!result) return res.status(404).json({error: '아직 저장된 검색 결과가 없습니다.'});
    if (strategy !== undefined) return await scoredResults(result,strategy,page,res);
    if (result.preliminary) {
      for (const [scope, {list}] of Object.entries(RECOMMENDATION_SCOPES)) {
        if (!hasCurrentRecommendationScreen(result, scope)) result.preliminary[list] = {};
      }
    }
    const ageDays = dataAgeDays(result.expectedDate, easternDate());
    return res.status(200).json({...result, ageDays, staleWarning: ageDays > 7});
  } catch {
    return res.status(503).json({error: '검색 결과 저장소에 연결하지 못했습니다.'});
  }
}
