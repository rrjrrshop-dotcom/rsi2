/** Private results stored outside the public Git repository. */
export function compactScan(result){
 if(!result||!/^\d{4}-\d{2}-\d{2}$/.test(result.expectedDate||'')||!Array.isArray(result.buy)||!Number.isInteger(result.total)||result.total<0)throw Error('invalid result');
 const out={expectedDate:result.expectedDate,total:result.total,buy:result.buy};
 if(Array.isArray(result.stale))out.stale=result.stale;
 if(Array.isArray(result.insufficient))out.insufficient=result.insufficient;
 if(Array.isArray(result.waiting))out.waitingCount=result.waiting.length;
 if(result.preliminary&&typeof result.preliminary==='object')out.preliminary=result.preliminary;
 if(typeof result.createdAt==='string')out.createdAt=result.createdAt;
 if(Number.isInteger(result.marketSessions))out.marketSessions=result.marketSessions;
 const payload=JSON.stringify(out);if(Buffer.byteLength(payload,'utf8')>8*1024*1024)throw Error('scan summary too large');
 return out;
}
export function resultStore({url,token,fetcher=fetch}){
 let base;try{base=new URL(url)}catch{throw Error('result storage not configured')}
 if(base.protocol!=='https:'||!base.hostname.endsWith('.upstash.io')||!token)throw Error('result storage not configured');
 async function command(args){const res=await fetcher(base.origin,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('result storage unavailable');const body=await res.json();if(body.error)throw Error('result storage unavailable');return body.result}
 return {async save(result){await command(['SET','rsi2:latest-result',JSON.stringify(compactScan(result))])},async load(){let value=await command(['GET','rsi2:latest-result']);return value?JSON.parse(value):null}};
}
