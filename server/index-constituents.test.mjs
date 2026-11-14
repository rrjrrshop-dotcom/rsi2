import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchNasdaq100Index, indexRecommendationUniverse} from './index-constituents.mjs';
import {mergeUniverse} from './universe.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_SCOPE, RECOMMENDATION_SCREEN_VERSION} from '../recommendation-policy.mjs';

test('Nasdaq-100 accepts a complete dated constituent list and rejects a truncated list', async () => {
  const rows = Array.from({length: 101}, (_, index) => ({symbol: `ND${index}`, companyName: `Company ${index}`}));
  const now = () => new Date('2026-11-14T08:00:00Z');
  const response = rows => async () => ({ok:true, json:async()=>({data:{totalrecords:101,offset:0,date:'Nov 13, 2026',data:{rows}}})});
  const result = await fetchNasdaq100Index({now, fetcher:response(rows)});
  assert.equal(result.securities.length, 101);
  assert.equal(result.asOf, '2026-11-13');
  await assert.rejects(fetchNasdaq100Index({now,fetcher:response(rows.slice(1))}), /incomplete/);
});

test('the index universe deduplicates cross-listed members and excludes the rest of the Nasdaq directory', () => {
  const stocks = (count, prefix) => Array.from({length:count}, (_, i) => ({symbol: `${prefix}${i}`,kind:'stock'}));
  const sp500 = stocks(502, 'SP');
  const indexes = {sp500, nasdaq100: [...stocks(100,'ND'), {...sp500[0]}], dow: sp500.slice(0,30)};
  const universe = mergeUniverse({indexes,nasdaq:[{symbol:'OTHER',kind:'stock',source:'nasdaq'}]});
  const result = indexRecommendationUniverse(universe.securities);
  assert.deepEqual(result.counts,{nasdaq100:101,sp500:502,dow:30});
  assert.equal(result.securities.length,602);
  assert.equal(result.securities.some(item=>item.symbol==='OTHER'),false);
  assert.deepEqual(result.securities.find(item=>item.symbol==='SP0').indexes, ['nasdaq100','sp500','dow']);
  assert.throws(() => indexRecommendationUniverse(universe.securities.filter(item=>item.symbol!=='SP0')), /incomplete/);
});

test('a previously saved wider scan cannot display recommendations under the new index scope', () => {
  const through = '2026-11-13';
  const screen = {version:RECOMMENDATION_SCREEN_VERSION,scope:RECOMMENDATION_SCOPE,status:'applied',through};
  const result = recommendationScreen => ({expectedDate:through,preliminary:{recommendationScreen}});
  assert.equal(hasCurrentRecommendationScreen(result(screen)),true);
  assert.equal(hasCurrentRecommendationScreen(result({...screen,version:1})),false);
  assert.equal(hasCurrentRecommendationScreen(result({...screen,scope:undefined})),false);
  assert.equal(hasCurrentRecommendationScreen(result({...screen,through:'2026-11-12'})),false);
});
