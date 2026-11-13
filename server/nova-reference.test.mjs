import {test} from 'node:test';
import assert from 'node:assert/strict';
import {experimentalNova} from '../nova-experimental.mjs';
import {newHoldout,laterHoldout} from '../research/nova-samples.mjs';
test('frozen experimental candidate matches recorded comparison outputs, without treating them as trading guarantees',()=>{
 const expected={INCY:7,DCTH:8,QMCO:2,AMD:3,NVDA:1,EWY:1};
 for(const row of [...newHoldout,...laterHoldout]) assert.equal(experimentalNova(row).score,expected[row.symbol],row.source);
});
