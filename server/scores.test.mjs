import {test} from 'node:test';import assert from 'node:assert/strict';import {scoreStrategy} from '../scores.mjs';
const bars=()=>Array.from({length:270},(_,i)=>{const d=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),p=100+i*.1;return {date:d,open:p,high:p+1,low:p-1,close:p,volume:1000}});
test('all provisional scores are bounded and deterministic',()=>{for(const id of ['1000','trend','box','rsi2','breakout']){const a=scoreStrategy(id,bars(),'AAA');assert.ok(a.score>=0&&a.score<=100);assert.equal(a.score,scoreStrategy(id,bars(),'AAA').score)}});
test('missing history cannot create a score',()=>assert.throws(()=>scoreStrategy('rsi2',bars().slice(-10))));
