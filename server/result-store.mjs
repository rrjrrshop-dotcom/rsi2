import {redisRest} from './redis-rest.mjs';

export const RESULT_KEY = 'rsi2:latest-result';
/** Private results stored outside the public Git repository. */
export function compactScan(result){
 if(!result||!/^\d{4}-\d{2}-\d{2}$/.test(result.expectedDate||'')||!Array.isArray(result.buy)||!Number.isInteger(result.total)||result.total<0)throw Error('invalid result');
 const out={expectedDate:result.expectedDate,total:result.total,buy:result.buy};
 if(Array.isArray(result.stale))out.stale=result.stale;
 if(Array.isArray(result.insufficient))out.insufficient=result.insufficient;
 if(Array.isArray(result.waiting))out.waitingCount=result.waiting.length;
 if(result.preliminary&&typeof result.preliminary==='object')out.preliminary=result.preliminary;
 if(typeof result.createdAt==='string')out.createdAt=result.createdAt;
 if(typeof result.marketReceivedAt==='string')out.marketReceivedAt=result.marketReceivedAt;
 if(Number.isInteger(result.marketSessions))out.marketSessions=result.marketSessions;
 const payload=JSON.stringify(out);if(Buffer.byteLength(payload,'utf8')>8*1024*1024)throw Error('scan summary too large');
 return out;
}
export function resultStore(settings){
 const {command} = redisRest(settings);
 return {async save(result){await command(['SET',RESULT_KEY,JSON.stringify(compactScan(result))])},async load(){let value=await command(['GET',RESULT_KEY]);return value?JSON.parse(value):null}};
}
