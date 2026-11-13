import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimate1000Score} from '../strategy1000-score.mjs';
import {newHoldout,laterHoldout} from '../research/strategy1000-samples.mjs';
test('frozen experimental candidate matches recorded comparison outputs, without treating them as trading guarantees',()=>{
 const expected={INCY:7,DCTH:8,QMCO:2,AMD:3,NVDA:1,EWY:1};
 for(const row of [...newHoldout,...laterHoldout]) assert.equal(estimate1000Score(row).score,expected[row.symbol],row.source);
});
