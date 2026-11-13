import {createHash,timingSafeEqual} from 'node:crypto';import {validateSubscription} from './web-push.mjs';
export function constantTimeEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
/** Storage interface keeps device endpoints out of static assets and public source. */
export function subscriptionService(store){return {
 async add(raw){const sub=validateSubscription(raw),id=createHash('sha256').update(sub.endpoint).digest('hex');await store.set(id,JSON.stringify(sub));return{id}},
 async remove(raw){const sub=validateSubscription(raw),id=createHash('sha256').update(sub.endpoint).digest('hex');await store.delete(id);return{id}}
}}
/** Upstash Redis REST hash adapter; credentials are supplied server-side. */
export function upstashSubscriptions({url,token,fetcher=fetch}){
 let base;try{base=new URL(url)}catch{throw Error('subscription store is not configured')}
 if(base.protocol!=='https:'||!base.hostname.endsWith('.upstash.io')||!token)throw Error('subscription store is not configured');
 async function command(args){const response=await fetcher(base.origin,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('subscription storage unavailable');const result=await response.json();if(result.error)throw Error('subscription storage unavailable');return result.result}
 return {set:(id,value)=>command(['HSET','rsi2:subscriptions',id,value]),delete:id=>command(['HDEL','rsi2:subscriptions',id]),async list(){const raw=await command(['HGETALL','rsi2:subscriptions']);if(!raw)return[];if(!Array.isArray(raw)||raw.length%2)throw Error('unexpected subscription storage result');const out=[];for(let i=0;i<raw.length;i+=2)out.push(JSON.parse(raw[i+1]));return out}};
}
