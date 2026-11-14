import {test} from 'node:test';import assert from 'node:assert/strict';import {analyzeBreakout, adjustBreakoutBars} from '../breakout.mjs';
import {scoreAnalysis} from '../scores.mjs';
const bars=()=>Array.from({length:70},(_,i)=>({date:`d${i}`,open:100,high:102,low:98,close:100,volume:100}));
test('channels exclude the evaluated bar and detect breakout',()=>{let b=bars();b.at(-1).high=120;b.at(-1).close=110;let r=analyzeBreakout(b);assert.equal(r.high20,102);assert.equal(r.high55,102);assert.equal(r.state,'both');assert.equal(r.entry,110)});
test('system 1 and downside states use prior channel',()=>{let b=bars();b[20].high=115;b.at(-1).close=105;assert.equal(analyzeBreakout(b).state,'s1');b.at(-1).close=97;assert.equal(analyzeBreakout(b).state,'down')});
test('Wilder ATR handles gaps and sizing uses unrounded ATR',()=>{let b=bars();b.at(-1).high=110;b.at(-1).low=108;b.at(-1).close=109;let r=analyzeBreakout(b);assert.equal(r.atr,(4*19+10)/20);assert.equal(r.unit,Math.floor(1000/(2*r.atr)));assert.equal(r.stop,r.entry-2*r.atr);assert.equal(r.levels[1],r.entry+.5*r.atr);assert.equal(r.total,r.costs.reduce((a,c)=>a+c,0))});
test('affordability accounts for rising unit costs',()=>{let b=bars();let r=analyzeBreakout(b,{allocation:100000,riskPercent:2});assert.equal(r.unit,250);assert.equal(r.affordable,3);assert.ok(r.total>r.allocation)});
test('reject insufficient or invalid data',()=>{assert.throws(()=>analyzeBreakout(bars().slice(0,55)));assert.throws(()=>analyzeBreakout(bars(),{allocation:0}))});

test('an intraday breach or a close that touches the channel does not earn an entry point', () => {
 const input = bars();
 input.at(-1).high = 120;
 for (const [close, state, passed] of [[101.5, 'wait', 0], [102, 'wait', 0], [102.01, 'both', 2]]) {
  input.at(-1).close = close;
  const result = analyzeBreakout(input);
  assert.equal(result.state, state);
  assert.equal(scoreAnalysis('breakout', result).passed, passed);
 }
});

test('cash dividends restate only bars before the ex-date and leave the final close and volume intact', () => {
 const dates = ['2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03'];
 const input = dates.map(date => ({date, open: 100, high: 103, low: 98, close: 100, volume: 300}));
 const adjusted = adjustBreakoutBars(input, [
  {date: '2026-10-30', amount: 2, currency: 'USD'},
  {date: '2026-10-30', amount: 3, currency: 'USD'},
  {date: '2026-11-02', amount: 4, currency: 'USD'},
  {date: '2026-11-03', amount: 30, currency: 'USD'},
  {date: '2026-11-04', amount: 30, currency: 'USD'},
 ]);
 const numbers = row => [row.open, row.high, row.low, row.close].map(x => +x.toFixed(4));
 assert.deepEqual(adjusted.map(row => +row.close.toFixed(2)), [91.2,96,100,100]);
 assert.deepEqual(numbers(adjusted[0]), [91.2,93.936,89.376,91.2]);
 assert.deepEqual(adjusted.map(row => row.volume), [300,300,300,300]);
 assert.equal(input[0].close, 100);
 assert.equal(adjusted.at(-1), input.at(-1));
 assert.throws(() => adjustBreakoutBars(input, [{date: dates[1], amount: 1, currency: 'GBP'}]), /달러 기준/);
});
