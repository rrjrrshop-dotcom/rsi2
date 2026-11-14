import {test} from 'node:test';import assert from 'node:assert/strict';import quote from '../api/quote.mjs';import results from '../api/results.mjs';
function response(){return {headers:{},statusCode:null,body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
test('personal code protects quote and saved results before any provider request',async()=>{
 const originalFetch=globalThis.fetch,originalEnv={...process.env};let calls=[];
 try{
  process.env.PAIRING_SECRET='test-personal-code';process.env.MASSIVE_API_KEY='provider-secret';process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='storage-secret';
  globalThis.fetch=async(url,opts)=>{calls.push(String(url));if(String(url).startsWith('https://api.massive.com/'))return {ok:true,json:async()=>({results:[{t:Date.UTC(2026,10,6,5),o:36,h:38,l:35,c:37.04,v:1000}]})};return {ok:true,json:async()=>({result:JSON.stringify({expectedDate:'2026-11-06',total:1,buy:[]})})}};
  for(const h of [quote,results]){const res=response();await h({method:'GET',query:{symbol:'UGI'},headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401)}assert.equal(calls.length,0);
  const qr=response();await quote({method:'GET',query:{symbol:'UGI'},headers:{authorization:'Bearer test-personal-code'}},qr);assert.equal(qr.statusCode,200);assert.equal(qr.body.bars[0].close,37.04);assert.ok(!JSON.stringify(qr.body).includes('provider-secret'));
  const headers = {authorization: 'Bearer test-personal-code'};
  const pinned = response();
  await quote({method: 'GET', query: {symbol: 'UGI', through: '2026-11-06'}, headers}, pinned);
  assert.equal(pinned.statusCode, 200);
  assert.equal(pinned.body.through, '2026-11-06');
  assert.ok(new URL(calls.at(-1)).pathname.endsWith('/2026-11-06'));
  for (const [through, code] of [['2026-11-07', 404], ['2026-02-30', 400], ['9999-01-01', 400]]) {
   const res = response();
   await quote({method: 'GET', query: {symbol: 'UGI', through}, headers}, res);
   assert.equal(res.statusCode, code);
  }
  const rr=response();await results({method:'GET',headers:{authorization:'Bearer test-personal-code'}},rr);assert.equal(rr.statusCode,200);assert.equal(rr.body.expectedDate,'2026-11-06');assert.ok(!JSON.stringify(rr.body).includes('storage-secret'));
 }finally{globalThis.fetch=originalFetch;for(const key of ['PAIRING_SECRET','MASSIVE_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key]}
});

test('only the breakout quote applies cash dividends through its actual confirmed session', async () => {
 const originalFetch = globalThis.fetch;
 const {PAIRING_SECRET, MASSIVE_API_KEY} = process.env;
 try {
  process.env.PAIRING_SECRET = 'test-personal-code';
  process.env.MASSIVE_API_KEY = 'provider-secret';
  const through = '2026-11-06';
  const history = [4,5,6].map(day => ({t: Date.UTC(2026,10,day,5), o: 100, h: 103, l: 98, c: 100, v: 100}));
  let dividendRequests = 0;
  globalThis.fetch = async url => {
   if (url.pathname !== '/stocks/v1/dividends') return {ok: true, json: async () => ({results: history})};
   dividendRequests++;
   assert.equal(url.searchParams.get('ex_dividend_date.lte'), through);
   assert.equal(url.searchParams.get('ticker'), 'KINS');
   return {ok: true, json: async () => ({results: [
    {id: 'd', ticker: 'KINS', ex_dividend_date: '2026-11-05', cash_amount: 4, split_adjusted_cash_amount: 2, currency: 'USD'},
    {id: 'future', ticker: 'KINS', ex_dividend_date: through, cash_amount: 25, split_adjusted_cash_amount: 25, currency: 'USD'},
   ]})};
  };
  const headers = {authorization: 'Bearer test-personal-code'};
  const raw = response();
  await quote({method: 'GET', headers, query: {symbol: 'KINS', through}}, raw);
  assert.equal(raw.statusCode, 200);
  assert.equal(raw.body.adjustment, 'split-adjusted');
  assert.equal(dividendRequests, 0);
  const breakout = response();
  await quote({method: 'GET', headers, query: {symbol: 'KINS', through, strategy: 'breakout'}}, breakout);
  assert.equal(breakout.statusCode, 200);
  assert.equal(breakout.body.adjustment, 'split-and-dividend-adjusted');
  assert.deepEqual(breakout.body.bars.map(b => b.close), [98,100,100]);
  assert.equal(dividendRequests, 1);
 } finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({PAIRING_SECRET, MASSIVE_API_KEY})) {
   if (value === undefined) delete process.env[key];
   else process.env[key] = value;
  }
 }
});
