import {analyze} from './signals.mjs';
import {analyze1000} from '../strategy1000.mjs';
import {analyzeTrend} from '../trend.mjs';
import {analyzeBox} from '../box.mjs';
import {adjustBreakoutBars, analyzeBreakout, BREAKOUT_ADJUSTMENT} from '../breakout.mjs';
import {compareScores, scoreAnalysis, scoreStrategy} from '../scores.mjs';
import {RECOMMENDATION_INDEXES, RECOMMENDATION_LIMIT, RECOMMENDATION_SCOPES} from '../recommendation-policy.mjs';

const emptyRankings = () => ({'1000': [], trend: [], box: [], rsi2: [], breakout: []});
/** Build chronological daily histories from market-wide snapshots.
 * Callers provide independently verified symbols and ordered trading dates.
 * A failed date aborts, rather than silently omitting a market session.
 */
export async function scanGrouped({symbols, dates, getDaily, onProgress = () => {}, recommendationMembership = new Map(),
 marketSymbols = [], getRecommendationCandidates = () => ({major: new Set(), all: new Set()}),
 getBreakoutDividends = () => new Map()}){
 if(!Array.isArray(symbols)||!symbols.length||!Array.isArray(dates)||!dates.length||typeof getDaily!=='function')throw Error('symbols, dates and getDaily required');
 const universe=[...new Set(symbols.map(s=>String(s).trim().toUpperCase()))];
 if(universe.some(s=>!/^[A-Z0-9.\-]{1,15}$/.test(s)))throw Error('invalid symbol');
 if(dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||(i&&dates[i-1]>=d)))throw Error('dates must be unique and increasing');
 const scanSymbols = new Set(universe);
 const history = new Map([...scanSymbols, ...marketSymbols].map(symbol => [symbol, []]));
 let count=0;
 for(const date of dates){
  const rows=await getDaily(date);if(!Array.isArray(rows)||!rows.length)throw Error(`Missing market data for ${date}`);
  const seen=new Set();for(const row of rows){if(!history.has(row.symbol))continue;if(seen.has(row.symbol))throw Error(`Duplicate ${row.symbol} ${date}`);seen.add(row.symbol);if(!Number.isFinite(row.close)||row.close<=0)throw Error(`Invalid price ${row.symbol} ${date}`);history.get(row.symbol).push({date,close:row.close,open:row.open,high:row.high,low:row.low,volume:row.volume});}
  onProgress({date,completed:++count,total:dates.length});
 }
 const [{major, all}, dividends] = await Promise.all([getRecommendationCandidates(), getBreakoutDividends()]);
 const expectedDate = dates.at(-1);
 const records = [];
 const preliminary = {trend: [], box: [], thousand: [], breakout: [], skipped: 0,
  recommendations: emptyRankings(), marketRecommendations: emptyRankings(), breakoutAdjustmentErrors: 0};
 for (const [symbol, bars] of history) {
  const originalScan = scanSymbols.has(symbol);
  const indexes = recommendationMembership.get(symbol);
  const verifiedIndexes = Array.isArray(indexes) && indexes.every(index => Object.hasOwn(RECOMMENDATION_INDEXES, index)) ? indexes : [];
  const inMajor = major.has(symbol) && verifiedIndexes.length > 0;
  const inMarket = all.has(symbol);
  const current = bars.at(-1)?.date === expectedDate;
  if (!originalScan && (!inMarket || !current)) continue;
  const rank = (inMajor || inMarket) && current;
  const listBreakout = originalScan && current && bars.length >= 252;
  let breakout;
  if ((rank || listBreakout) && bars.length >= 56) {
   let breakoutBars;
   try { breakoutBars = adjustBreakoutBars(bars, dividends.get(symbol) ?? []); }
   catch { preliminary.breakoutAdjustmentErrors++; }
   if (breakoutBars) {
    try { breakout = analyzeBreakout(breakoutBars, {includeLines: false}); } catch { /* Invalid OHLC or ATR. */ }
   }
  }
  const r = analyze(bars);
  if (originalScan) records.push({symbol, ...(r.date === expectedDate ? r : {status: 'stale', date: r.date, expectedDate})});
  if (rank) {
   for (const id of Object.keys(preliminary.recommendations)) {
    if (id === 'breakout' && !breakout) continue;
    try {
     const daily = id === '1000' ? analyze1000(bars) : null;
     const analysis = daily ?? (id === 'rsi2' ? r : id === 'breakout' ? breakout : null);
     const score = analysis ? scoreAnalysis(id, analysis) : scoreStrategy(id, bars, symbol);
     const item = {symbol, ...score, indexes: verifiedIndexes, date: expectedDate,
      ...(daily ? {dailyFrame: {date: expectedDate, trend: daily.trend}} : {}),
      ...(id === 'breakout' ? {adjustment: BREAKOUT_ADJUSTMENT} : {})};
     if (inMajor) preliminary.recommendations[id].push(item);
     if (inMarket) preliminary.marketRecommendations[id].push(item);
    } catch { /* History may be insufficient for this strategy. */ }
   }
  }
  if (!originalScan) continue;
  if(!current||bars.length<252){preliminary.skipped++;continue}
  try{const t=analyzeTrend(bars);preliminary.trend.push({symbol,score:t.passed,known:7,total:8,close:t.close,date:t.date});}catch{preliminary.skipped++;continue}
  try{const t=analyze1000(bars);preliminary.thousand.push({symbol,above:t.above,close:t.close,date:t.date});}catch{}
  if (breakout?.signals.s1) {
   const {state, close, high20, atr, date} = breakout;
   preliminary.breakout.push({symbol, state, close, high20, atr, date});
  }
  try{const b=analyzeBox(bars);if(b.upper!==null&&b.volumeRatio!==null)preliminary.box.push({symbol,close:b.close,upper:b.upper,lower:b.lower,volumeRatio:b.volumeRatio,aboveSma:b.close>b.sma30,date:b.date});}catch{}
 }
 for (const {list} of Object.values(RECOMMENDATION_SCOPES)) {
  for (const rows of Object.values(preliminary[list])) {
   rows.sort(compareScores);
   rows.splice(RECOMMENDATION_LIMIT);
  }
 }
 preliminary.breakout.sort((a,b)=>Number(b.state==='both')-Number(a.state==='both')||(a.close-a.high20)/a.atr-(b.close-b.high20)/b.atr||a.symbol.localeCompare(b.symbol));
 preliminary.trend.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
 preliminary.thousand.sort((a,b)=>b.above-a.above||a.symbol.localeCompare(b.symbol));
 preliminary.box.sort((a,b)=>Number(b.close>b.upper&&b.aboveSma)-Number(a.close>a.upper&&a.aboveSma)||b.volumeRatio-a.volumeRatio||a.symbol.localeCompare(b.symbol));
 for(const k of ['trend','box','thousand','breakout'])preliminary[k]=preliminary[k].slice(0,10);
 const group=status=>records.filter(x=>x.status===status);
 return {expectedDate,total:universe.length,marketSessions:dates.length,buy:group('buy'),waiting:group('wait'),insufficient:group('insufficient'),stale:group('stale'),preliminary};
}
