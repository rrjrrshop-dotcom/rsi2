/** State persisted in private Redis; only fixed logical keys are permitted. */
const allowed=new Set(['rsi2:holdings-symbols','rsi2:notification-state']);
export function privateState({url,token,fetcher=fetch}){
 let base;try{base=new URL(url)}catch{throw Error('state storage not configured')}
 if(base.protocol!=='https:'||!base.hostname.endsWith('.upstash.io')||!token)throw Error('state storage not configured');
 async function command(args){const response=await fetcher(base.origin,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('state storage unavailable');const body=await response.json();if(body.error)throw Error('state storage unavailable');return body.result}
 return {async get(key){if(!allowed.has(key))throw Error('unknown state key');const value=await command(['GET',key]);return value?JSON.parse(value):null},async set(key,value){if(!allowed.has(key))throw Error('unknown state key');await command(['SET',key,JSON.stringify(value)])}};
}
export function validateHoldings(symbols){if(!Array.isArray(symbols)||symbols.length>1000)throw Error('invalid holdings');const out=symbols.map(s=>String(s).trim().toUpperCase());if(out.some(s=>!/^[A-Z0-9.\-]{1,15}$/.test(s)))throw Error('invalid holdings');return [...new Set(out)]}
