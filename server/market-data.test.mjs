import assert from 'node:assert/strict';import {makeMarketData} from './market-data.mjs';
const client=makeMarketData({key:'test',fetcher:async url=>({ok:true,json:async()=>({results:[{t:Date.UTC(2026,10,6),o:1,h:3,l:1,c:2,v:10}]})})});
assert.equal((await client.daily('UGI','2026-11-01','2026-11-07'))[0].close,2);
await assert.rejects(client.daily('../UGI','2026-11-01','2026-11-07'));
const limited=makeMarketData({key:'test',fetcher:async()=>({ok:false,status:429})});await assert.rejects(limited.daily('UGI','2026-11-01','2026-11-07'),/요청 한도/);
console.log('market data client tests passed');
