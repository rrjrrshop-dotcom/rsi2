import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveState,historicalWaveRates} from '../wave-analysis.mjs';
const bars=[...Array(30).fill(100),115,130,122,119,150,145,138,165].map(close=>({close}));
test('counts a candidate impulse and its closing-price invalidation',()=>{
 const state=waveState(bars);
 assert.equal(state.stage,'5');
 assert.equal(state.direction,1);
 assert.equal(state.invalid,138);
 assert.equal(waveState(bars.slice(0,34)).stage,'2');
});
test('suppresses frequencies when comparable observations are insufficient',()=>{
 const rates=historicalWaveRates(bars,waveState(bars));
 assert.deepEqual(rates.map(({horizon,n,available})=>[horizon,n,available]),[[5,0,false],[20,0,false]]);
});
