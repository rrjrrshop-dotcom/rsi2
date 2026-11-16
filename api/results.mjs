import {easternDate, dataAgeDays} from '../server/trading-calendar.mjs';
import {constantTimeEqual} from '../server/subscriptions.mjs';
import {marketCache, pricesThrough, dividendsThrough} from '../server/market-cache.mjs';
import {adjustBreakoutBars, BREAKOUT_ADJUSTMENT} from '../breakout.mjs';
import {compareScores, scoreAnalysis, scoreStrategy, THOUSAND_SCORE_TOTAL} from '../scores.mjs';
import {scoreOutOf100} from '../score-scale.mjs';
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
  const rows = await Promise.all(candidates.map(async candidate => {
    const {symbol} = candidate;
    if (strategy === 'rsi2' &&
        [candidate.close, candidate.sma200, candidate.sma5, candidate.rsi].every(Number.isFinite) &&
        typeof candidate.exit === 'boolean') {
      return {symbol,date:meta.through,...scoreAnalysis(strategy,candidate)};
    }
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
  rows.sort((left,right) => (scoreOutOf100(right) ?? -1) - (scoreOutOf100(left) ?? -1));
  return res.status(200).json({rows:rows.slice(page*pageSize,(page+1)*pageSize),expectedDate:meta.through,page,pages:Math.ceil(rows.length/pageSize),total:rows.length,
    staleWarning:dataAgeDays(meta.through,easternDate())>7});
}

// An earlier batch saved the old seven-condition scores alongside the shortlist.
async function refreshStoredThousand(result) {
  const lists = Object.values(RECOMMENDATION_SCOPES)
    .map(({list}) => result.preliminary[list])
    .filter(ranking => ranking?.['1000']?.some(row => row.total !== THOUSAND_SCORE_TOTAL));
  if (!lists.length) return;
  const store = marketCache();
  const meta = await store.current();
  const legacy = new Set(lists.flatMap(ranking => ranking['1000']
    .filter(row => row.total !== THOUSAND_SCORE_TOTAL).map(row => row.symbol)));
  const scores = new Map(await Promise.all([...legacy].map(async symbol => {
    if (meta?.through !== result.expectedDate) return [symbol, null];
    const record = await store.record(meta, symbol);
    if (record?.bars.at(-1)?.date !== meta.through) return [symbol, null];
    try { return [symbol, scoreStrategy('1000', pricesThrough(record, meta.through), symbol)]; }
    catch { return [symbol, null]; }
  })));
  for (const ranking of lists) {
    ranking['1000'] = ranking['1000'].flatMap(row => {
      if (row.total === THOUSAND_SCORE_TOTAL) return [row];
      const score = scores.get(row.symbol);
      return score && row.date === result.expectedDate ? [{...row, ...score}] : [];
    }).sort(compareScores);
  }
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
      await refreshStoredThousand(result);
    }
    const ageDays = dataAgeDays(result.expectedDate, easternDate());
    return res.status(200).json({...result, ageDays, staleWarning: ageDays > 7});
  } catch {
    return res.status(503).json({error: '검색 결과 저장소에 연결하지 못했습니다.'});
  }
}
