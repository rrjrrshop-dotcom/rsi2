import {test} from 'node:test';import assert from 'node:assert/strict';import quote from '../api/quote.mjs';import results from '../api/results.mjs';
function response(){return {headers:{},statusCode:null,body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
test('personal code protects quote and saved results before any provider request',async()=>{
 const originalFetch=globalThis.fetch,originalEnv={...process.env};let calls=[];
 try{
  process.env.PAIRING_SECRET='test-personal-code';process.env.MASSIVE_API_KEY='provider-secret';process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='storage-secret';
  globalThis.fetch=async(url,opts)=>{calls.push(String(url));if(String(url).startsWith('https://api.massive.com/'))return {ok:true,json:async()=>({results:[{t:Date.UTC(2026,10,6,5),o:36,h:38,l:35,c:37.04,v:1000}]})};return {ok:true,json:async()=>({result:JSON.stringify({expectedDate:'2026-11-06',total:1,buy:[]})})}};
  for(const h of [quote,results]){const res=response();await h({method:'GET',query:{symbol:'UGI'},headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401)}assert.equal(calls.length,0);
  const qr=response();await quote({method:'GET',query:{symbol:'UGI'},headers:{authorization:'Bearer test-personal-code'}},qr);assert.equal(qr.statusCode,200);assert.equal(qr.body.bars[0].close,37.04);assert.ok(!JSON.stringify(qr.body).includes('provider-secret'));
  const rr=response();await results({method:'GET',headers:{authorization:'Bearer test-personal-code'}},rr);assert.equal(rr.statusCode,200);assert.equal(rr.body.expectedDate,'2026-11-06');assert.ok(!JSON.stringify(rr.body).includes('storage-secret'));
 }finally{globalThis.fetch=originalFetch;for(const key of ['PAIRING_SECRET','MASSIVE_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key]}
});
