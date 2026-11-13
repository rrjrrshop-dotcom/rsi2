import {analyze} from './signals.mjs';
import {analyze1000} from '../strategy1000.mjs';
import {analyzeTrend} from '../trend.mjs';
import {analyzeBox} from '../box.mjs';
import {analyzeBreakout} from '../breakout.mjs';
import {scoreStrategy} from '../scores.mjs';
/** Build chronological daily histories from market-wide snapshots.
 * Callers provide independently verified symbols and ordered trading dates.
 * A failed date aborts, rather than silently omitting a market session.
 */
export async function scanGrouped({symbols,dates,getDaily,onProgress=()=>{}}){
 if(!Array.isArray(symbols)||!symbols.length||!Array.isArray(dates)||!dates.length||typeof getDaily!=='function')throw Error('symbols, dates and getDaily required');
 const universe=[...new Set(symbols.map(s=>String(s).trim().toUpperCase()))];
 if(universe.some(s=>!/^[A-Z0-9.\-]{1,15}$/.test(s)))throw Error('invalid symbol');
 if(dates.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||(i&&dates[i-1]>=d)))throw Error('dates must be unique and increasing');
 const history=new Map(universe.map(s=>[s,[]]));let count=0;
 for(const date of dates){
  const rows=await getDaily(date);if(!Array.isArray(rows)||!rows.length)throw Error(`Missing market data for ${date}`);
  const seen=new Set();for(const row of rows){if(!history.has(row.symbol))continue;if(seen.has(row.symbol))throw Error(`Duplicate ${row.symbol} ${date}`);seen.add(row.symbol);if(!Number.isFinite(row.close)||row.close<=0)throw Error(`Invalid price ${row.symbol} ${date}`);history.get(row.symbol).push({date,close:row.close,open:row.open,high:row.high,low:row.low,volume:row.volume});}
  onProgress({date,completed:++count,total:dates.length});
 }
 const expectedDate=dates.at(-1),records=[],preliminary={trend:[],box:[],thousand:[],breakout:[],recommendations:{'1000':[],trend:[],box:[],rsi2:[],breakout:[]},skipped:0};
 for(const [symbol,bars] of history){let r=analyze(bars);if(r.date!==expectedDate)r={status:'stale',date:r.date,expectedDate};records.push({symbol,...r});
  if(bars.at(-1)?.date===expectedDate){for(const id of Object.keys(preliminary.recommendations)){try{const score=scoreStrategy(id,bars,symbol);const dailyFrame=id==='1000'?{date:expectedDate,trend:analyze1000(bars).trend}:undefined;preliminary.recommendations[id].push({symbol,...score,date:expectedDate,...(dailyFrame?{dailyFrame}:{})})}catch{}}}
  if(bars.at(-1)?.date!==expectedDate||bars.length<252){preliminary.skipped++;continue}
  try{const t=analyzeTrend(bars);preliminary.trend.push({symbol,score:t.passed,known:7,total:8,close:t.close,date:t.date});}catch{preliminary.skipped++;continue}
  try{const t=analyze1000(bars);preliminary.thousand.push({symbol,above:t.above,close:t.close,date:t.date});}catch{}
  try{const b=analyzeBreakout(bars,{includeLines:false});if(b.state==='both'||b.state==='s1')preliminary.breakout.push({symbol,state:b.state,close:b.close,high20:b.high20,atr:b.atr,date:b.date});}catch{}
  try{const b=analyzeBox(bars);if(b.upper!==null&&b.volumeRatio!==null)preliminary.box.push({symbol,close:b.close,upper:b.upper,lower:b.lower,volumeRatio:b.volumeRatio,aboveSma:b.close>b.sma30,date:b.date});}catch{}
 }
 for(const rows of Object.values(preliminary.recommendations)){rows.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));rows.splice(5)}
 preliminary.breakout.sort((a,b)=>Number(b.state==='both')-Number(a.state==='both')||(a.close-a.high20)/a.atr-(b.close-b.high20)/b.atr||a.symbol.localeCompare(b.symbol));
 preliminary.trend.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
 preliminary.thousand.sort((a,b)=>b.above-a.above||a.symbol.localeCompare(b.symbol));
 preliminary.box.sort((a,b)=>Number(b.close>b.upper&&b.aboveSma)-Number(a.close>a.upper&&a.aboveSma)||b.volumeRatio-a.volumeRatio||a.symbol.localeCompare(b.symbol));
 for(const k of ['trend','box','thousand','breakout'])preliminary[k]=preliminary[k].slice(0,10);
 const group=status=>records.filter(x=>x.status===status);
 return {expectedDate,total:universe.length,marketSessions:dates.length,buy:group('buy'),waiting:group('wait'),insufficient:group('insufficient'),stale:group('stale'),preliminary};
}
