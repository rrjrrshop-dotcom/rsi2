import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readHoldingsImage, reconcileHoldings} from '../holdings-import.mjs';

const tsv = words => words.map(([text,x,y]) => ['5',1,1,1,1,1,x,y,28,14,95,text].join('\t')).join('\n');
test('uses shares and cost columns in the desktop portfolio image', () => {
 const rows = readHoldingsImage(tsv([
  ['Ticker',18,60],['Company',105,60],['Shares',670,60],['Cost',742,60],
  ['SNXX',42,100],['Buy',515,100],['1,010',680,100],['17.84',742,100],
 ]),1000);
 assert.deepEqual(rows,[{symbol:'SNXX',qty:1010,price:17.84,source:'매입가 열'}]);
});
test('derives and labels cost from USD market value and signed gain', () => {
 const rows = readHoldingsImage(tsv([
  ['엔비디아',80,100],['1,937.8800USD',290,100],['12주',84,125],['-675.9000(-25.89%)',270,125],
  ['네비우스',80,190],['7,869.6400USD',290,190],['71주',84,215],['+1,461.1400(+22.83%)',270,215],
 ]),450);
 assert.equal(rows.length,2);
 assert.deepEqual([rows[0].symbol,rows[0].qty,rows[0].price],['NVDA',12,217.815]);
 assert.match(rows[0].source,/추정/);
});
test('rejects incomplete and duplicate rows before applying changes',()=>{
 const before=[{symbol:'NVDA',qty:12,price:217.55}];
 assert.throws(()=>reconcileHoldings(before,[{symbol:'NVDA',qty:1,price:1}]),/중복/);
 assert.throws(()=>reconcileHoldings(before,[{symbol:' nvda ',qty:'12',price:'217.550'}]),/매수가와 수량이 같은/);
 const exact={symbol:'NVDA',qty:12,price:217.55};
 assert.throws(()=>reconcileHoldings([], [exact,exact]),/매수가와 수량이 같은/);
 assert.deepEqual(before,[exact]);
 assert.throws(()=>reconcileHoldings(before,[{symbol:'',qty:2,price:1}]),/티커/);
 assert.deepEqual(reconcileHoldings(before,[{symbol:'qld',qty:'0.02',price:'90'}]).at(-1),{symbol:'QLD',qty:.02,price:90});
});
