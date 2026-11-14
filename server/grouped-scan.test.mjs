import {test} from 'node:test';import assert from 'node:assert/strict';import {scanGrouped} from './grouped-scan.mjs';
const dates=Array.from({length:210},(_,i)=>new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10));
test('distinguishes current, stale and insufficient symbols',async()=>{const r=await scanGrouped({symbols:['AAA','BBB','CCC','aaa'],dates,getDaily:async d=>{let i=dates.indexOf(d);return [{symbol:'AAA',close:100+i},...(i<209?[{symbol:'BBB',close:100+i}]:[]),...(i>205?[{symbol:'CCC',close:20+i}]:[])]}});assert.equal(r.total,3);assert.equal(r.waiting.length,1);assert.equal(r.stale.length,1);assert.equal(r.insufficient.length,1)});
test('rejects missing market sessions instead of silently skipping',async()=>{await assert.rejects(scanGrouped({symbols:['AAA'],dates:['2026-01-02'],getDaily:async()=>[]}),/Missing market data/)});
test('rejects duplicated sessions',async()=>{await assert.rejects(scanGrouped({symbols:['AAA'],dates:['2026-01-02','2026-01-02'],getDaily:async()=>[]}),/increasing/)});

test('only breakout rankings use dividend-adjusted prices in both scopes', async () => {
 const expectedDate = dates.at(-1);
 const scan = {
  symbols: ['AAA'], dates, recommendationMembership: new Map([['AAA', ['sp500']]]),
  getRecommendationCandidates: async () => ({major: new Set(['AAA']), all: new Set(['AAA'])}),
  getDaily: async date => [{symbol: 'AAA', open: 100, high: date === dates.at(-2) ? 100.5 : 102, low: 98,
   close: date === expectedDate ? 101 : 100, volume: 1000}],
 };
 const original = await scanGrouped(scan);
 const withDividend = await scanGrouped({...scan, getBreakoutDividends: async () => new Map([
  ['AAA', [{date: dates.at(-2), amount: 3, currency: 'USD'}]],
 ])});
 for (const list of ['recommendations','marketRecommendations']) {
  assert.equal(original.preliminary[list].breakout[0].passed, 0);
  assert.equal(withDividend.preliminary[list].breakout[0].passed, 2);
  assert.equal(withDividend.preliminary[list].breakout[0].adjustment, 'split-and-dividend-adjusted');
  assert.deepEqual(withDividend.preliminary[list].rsi2, original.preliminary[list].rsi2);
 }
 assert.deepEqual(withDividend.waiting, original.waiting);
});
