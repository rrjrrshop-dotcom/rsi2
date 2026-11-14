import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimate1000Score} from '../strategy1000-score.mjs';
import * as groups from '../research/strategy1000-samples.mjs';
test('weighted daily candidate reproduces 29 of 30 transcribed examples and preserves the unresolved PLTR error',()=>{
 const rows=Object.values(groups).flat();
 assert.equal(rows.length,30);
 const differences=rows.filter(row=>estimate1000Score(row).score!==row.observed);
 assert.deepEqual(differences.map(row=>({symbol:row.symbol,observed:row.observed,predicted:estimate1000Score(row).score})),[{symbol:'PLTR',observed:4,predicted:3}]);
});
