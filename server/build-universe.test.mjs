import {test} from 'node:test';import assert from 'node:assert/strict';import {fetchIndex} from '../scripts/build-universe.mjs';
const f=data=>async()=>({ok:true,json:async()=>data});const now=new Date('2026-11-10T00:00:00Z');
test('accepts fresh index constituents',async()=>{let x=await fetchIndex('https://example.com/a',{today:now,fetcher:f({asOf:'2026-11-09',securities:[{symbol:'abc'}]})});assert.equal(x.securities[0].symbol,'ABC')});
test('fails on stale or duplicate sources',async()=>{await assert.rejects(fetchIndex('https://example.com/a',{today:now,fetcher:f({asOf:'2026-10-01',securities:[{symbol:'ABC'}]})}),/stale/);await assert.rejects(fetchIndex('https://example.com/a',{today:now,fetcher:f({asOf:'2026-11-09',securities:[{symbol:'ABC'},{symbol:'ABC'}]})}),/duplicate/)});
