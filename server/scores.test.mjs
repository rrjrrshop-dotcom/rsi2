import {test} from 'node:test';import assert from 'node:assert/strict';import {scoreAnalysis,scoreStrategy} from '../scores.mjs';
const bars=()=>Array.from({length:270},(_,i)=>{const d=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),p=100+i*.1;return {date:d,open:p,high:p+1,low:p-1,close:p,volume:1000}});
test('each tab reports the applicable entry conditions with a consistent denominator', () => {
  for (const [id, total] of Object.entries({1000:7, trend:8, box:4, rsi2:2, breakout:2})) {
    const result = scoreStrategy(id,bars(),'AAA');
    assert.equal(result.total,total);
    assert.deepEqual(result,scoreStrategy(id,bars(),'AAA'));
  }
});
test('an unverified relative strength stays distinct from failure and an RSI exit does not change the entry score', () => {
  const trend = scoreStrategy('trend', bars(), 'AAA');
  assert.equal(trend.conditions[7].passed, null);
  const rsi = scoreAnalysis('rsi2', {close:150, sma200:140, sma5:142, rsi:5, exit:true});
  assert.deepEqual(rsi.conditions.map(item=>item.passed), [true,false]);
  assert.equal(rsi.passed, 1);
  assert.equal(rsi.exitConditions[0].passed, true);
});
test('missing history cannot create a score',()=>assert.throws(()=>scoreStrategy('rsi2',bars().slice(-10))));
