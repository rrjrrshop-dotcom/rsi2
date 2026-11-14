import assert from 'node:assert/strict';import {makeMarketData} from './market-data.mjs';
import {test} from 'node:test';
const client=makeMarketData({key:'test',fetcher:async url=>({ok:true,json:async()=>({results:[{t:Date.UTC(2026,10,6),o:1,h:3,l:1,c:2,v:10}]})})});
assert.equal((await client.daily('UGI','2026-11-01','2026-11-07'))[0].close,2);
await assert.rejects(client.daily('../UGI','2026-11-01','2026-11-07'));
const limited=makeMarketData({key:'test',fetcher:async()=>({ok:false,status:429})});await assert.rejects(limited.daily('UGI','2026-11-01','2026-11-07'),/요청 한도/);
console.log('market data client tests passed');

test('cash dividend pages retain share-adjusted dollar amounts and the selected dates', async () => {
 const queries = [];
 const item = {ticker: 'AAA', id: 'cash1', ex_dividend_date: '2026-10-30', cash_amount: 2,
  split_adjusted_cash_amount: .5, currency: 'USD'};
 const client = makeMarketData({key: 'test', fetcher: async url => {
  queries.push(url);
  return {ok: true, json: async () => queries.length === 1
   ? {results: [item], next_url: 'https://api.massive.com/stocks/v1/dividends?cursor=next'}
   : {results: [item, {...item, id: 'cash2', ex_dividend_date: '2026-11-03'}]}};
 }});
 const dividends = await client.dividends('2026-10-28', '2026-11-13', {symbol: 'AAA'});
 assert.equal(queries[0].searchParams.get('ticker'), 'AAA');
 assert.equal(queries[0].searchParams.get('ex_dividend_date.gt'), '2026-10-28');
 assert.equal(queries[0].searchParams.get('ex_dividend_date.lte'), '2026-11-13');
 assert.deepEqual(dividends.get('AAA'), [
  {date: '2026-10-30', amount: .5, currency: 'USD'}, {date: '2026-11-03', amount: .5, currency: 'USD'},
 ]);
});
