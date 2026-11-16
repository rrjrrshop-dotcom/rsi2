import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvScores,csvInputs} from '../csv-scores.mjs';
const HEAD=['Date','Symbol','Open','High','Low','Close','Volume'];
const data=Array.from({length:350},(_,i)=>{
 const day=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
 const close=100+i/5+Math.sin(i);
 return [day,'SPY',close,close+1,close-1,close,200].map(String);
});
test('the same local CSV produces each strategy score',()=>{
 for(const [id,total] of Object.entries({'1000':9,trend:8,box:4,rsi2:2,breakout:2})){
  const [row]=csvScores(id,[HEAD,...data]);
  assert.equal(row.score?.total,total,id+' '+row.error);
  assert.equal(row.date,data.at(-1)[0]);
  assert.ok(csvInputs[id]);
 }
});
test('close-only CSV works for RSI2 and cannot create OHLC scores',()=>{
 const rows=[['Date','Close'],...data.map(row=>[row[0],row[5]])];
 assert.equal(csvScores('rsi2',rows)[0].score.total,2);
 assert.throws(()=>csvScores('breakout',rows),/필요한 CSV 열/);
});
test('duplicate dates are detected within a ticker',()=>{
 const [row]=csvScores('trend',[HEAD,...data,data[0]]);
 assert.match(row.error,/중복/);
});
