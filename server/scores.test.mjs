import {scoreText} from '../score-card.mjs';
import {scoreOutOf100} from '../score-scale.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {scoreAnalysis,scoreStrategy} from '../scores.mjs';
const bars=()=>Array.from({length:270},(_,i)=>{const d=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),p=100+i*.1;return {date:d,open:p,high:p+1,low:p-1,close:p,volume:1000}});
test('each tab reports the applicable entry conditions with a consistent denominator', () => {
  for (const [id, total] of Object.entries({1000:9, trend:8, box:4, rsi2:2, breakout:2})) {
    const result = scoreStrategy(id,bars(),'AAA');
    assert.equal(result.total,total);
    assert.equal(result.heading, id + ' score');
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

test('fraction and 100-point labels work for existing score objects', () => {
  assert.equal(scoreText({passed:8,total:8}), '8/8점 · 100점');
  assert.equal(scoreText({passed:7,total:8}), '7/8점 · 87.5점');
  assert.equal(scoreText({passed:6,total:7}), '6/7점 · 85.7점');
  assert.equal(scoreOutOf100({passed:0,total:2}), 0);
  assert.equal(scoreText({passed:0,total:0}), '점수 확인 불가');
});

test('1000 counts the nine daily checks separately with ANET screenshot indicators', () => {
  const result = scoreAnalysis('1000', {
    close:202.40, ema8:189.40, ema13:186.43, ema21:186.18, ema55:188.24,
    previousClose:198, previousEma55:188, rising:true, above:3,
    macd:-.020, signal:-3.819, k:86.05, d:84.80,
    // Illustrative recent line ordering, with EMA13 crossing EMA21.
    series:{e8:[178,181,184,186,189.40], e13:[180,181,182,184,186.43], e21:[183,183,184,185,186.18]},
  });
  assert.deepEqual(result.conditions.map(({passed})=>passed), [true,true,true,true,false,false,true,true,true]);
  assert.equal(scoreText(result), '7/9점 · 77.8점');
  assert.equal(result.exitConditions[0].passed, false);
});

test('1000 scores 100 when all nine conditions pass and a crossing outside five sessions expires', () => {
  const result = scoreAnalysis('1000', {
    close:110, ema8:109, ema13:108, ema21:107, ema55:100,
    previousClose:109, previousEma55:100, rising:true, above:3,
    macd:2, signal:1, k:70, d:60,
    series:{e8:[90,105,106,107,108,109], e13:[91,104,105,106,107,108], e21:[92,103,104,105,106,107]},
  });
  assert.equal(scoreText(result), '9/9점 · 100점');
});

test('1000 gives no points to the SNDK bearish layout even without a recent crossing', () => {
  const result = scoreAnalysis('1000', {
    close:823, ema8:922.70, ema13:991.53, ema21:1092.6, ema55:1315.38,
    previousClose:850, previousEma55:1330, rising:false, above:0,
    macd:-166.727, signal:-153.939, k:12.2, d:16.6,
    series:{e8:[980,965,950,935,922.70],e13:[1040,1025,1010,1000,991.53],e21:[1140,1125,1110,1100,1092.6]},
  });
  assert.ok(result.conditions.every(({passed})=>passed===false));
  assert.equal(scoreText(result), '0/9점 · 0점');
  assert.equal(result.exitConditions[0].passed, true);
});

test('1000 gauge fails while close remains below EMA55 even above all three short EMAs', () => {
  const result = scoreAnalysis('1000', {
    close:110, ema8:109, ema13:108, ema21:107, ema55:112,
    previousClose:109, previousEma55:112, rising:true, above:3,
    macd:2, signal:1, k:70, d:60,
  });
  assert.equal(result.conditions[6].passed, false);
});
