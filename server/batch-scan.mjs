import {analyze} from './signals.mjs';
/** Scan a known symbol list with bounded concurrency and explicit failures.
 * getBars is injected to keep storage, rate limits and market access separate.
 */
export async function scanSymbols({symbols,getBars,expectedDate,concurrency=1,onProgress=()=>{}}){
 if(!Array.isArray(symbols)||typeof getBars!=='function')throw new TypeError('symbols and getBars required');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>5)throw new RangeError('concurrency must be 1 to 5');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate))throw new Error('expected date required');
 const unique=[...new Set(symbols.map(x=>String(x).trim().toUpperCase()).filter(Boolean))];
 if(unique.some(x=>!/^[A-Z0-9.\-]{1,15}$/.test(x)))throw new Error('invalid symbol');
 const records=new Array(unique.length);let next=0,completed=0;
 async function worker(){while(true){const i=next++;if(i>=unique.length)return;const symbol=unique[i];try{const bars=await getBars(symbol);const result=analyze(bars);records[i]=result.date!==expectedDate?{symbol,status:'stale',date:result.date,expectedDate}:{symbol,...result}}catch(e){records[i]={symbol,status:'error',error:e.message}}completed++;onProgress({completed,total:unique.length,symbol})}}
 await Promise.all(Array.from({length:Math.min(concurrency,unique.length)},worker));
 return {expectedDate,total:unique.length,buy:records.filter(r=>r.status==='buy'),waiting:records.filter(r=>r.status==='wait'),insufficient:records.filter(r=>r.status==='insufficient'),stale:records.filter(r=>r.status==='stale'),errors:records.filter(r=>r.status==='error')};
}
/** Serialize starts across concurrent workers to respect provider per-minute limits. */
export function rateLimit(fn,{intervalMs=13000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),clock=()=>Date.now()}={}){
 let lastStart=-Infinity,queue=Promise.resolve();return (...args)=>{let release;const prev=queue;queue=new Promise(resolve=>{release=resolve});return (async()=>{await prev;try{const delay=Math.max(0,lastStart+intervalMs-clock());if(delay)await sleep(delay);lastStart=clock()}finally{release()}return fn(...args)})()};
}
