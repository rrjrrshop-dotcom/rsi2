// Comparison against visible, rounded screenshot values, not reconstructed OHLC.
import assert from 'node:assert/strict';
import {evaluateTrend} from '../trend.mjs';
import {classifyRsi2} from '../server/signals.mjs';
import {calculatePosition} from '../breakout.mjs';
const trend=[
 {name:'META 11-02',close:606.73,s50:670.93,s150:628.17,s200:631.21,prior200:627.82,low:519.37,high:779.82,shown:[false,false,true,false,false,false,true],rs:false,total:2},
 {name:'AAON 11-10',close:75.01,s50:76.71,s150:98.41,s200:96.54,prior200:98.01,low:53.13,high:150.16,shown:[false,true,false,false,false,true,false],rs:false,total:2},
 {name:'WST 11-09',close:413.09,s50:374.42,s150:342.46,s200:317.69,prior200:304.99,low:223.52,high:438.27,shown:[true,true,true,true,true,true,true],rs:true,total:8},
 {name:'IMSR 11-09',close:3,s50:3.82,s150:5.70,s200:6.06,prior200:6.68,low:2.44,high:14.28,shown:[false,false,false,false,false,false,false],rs:false,total:0},
 {name:'BE 11-09',close:193.88,s50:245.73,s150:246.67,s200:222.66,prior200:213.28,low:75.70,high:351.28,shown:[false,true,true,false,false,true,false],rs:true,total:4},
 {name:'NVDA 11-10',close:168.89,s50:217.97,s150:211.75,s200:204.26,prior200:202.22,low:163.90,high:243.37,shown:[false,true,true,true,false,false,false],rs:false,total:3},
 {name:'NVDA 11-11',close:173.73,s50:217.10,s150:211.68,s200:204.19,prior200:202.37,low:163.90,high:243.37,shown:[false,true,true,true,false,false,false],rs:false,total:3},
 {name:'SNDK 11-11',close:985.65,s50:1467.31,s150:1491.05,s200:1278.70,prior200:1199.66,low:183,high:2354.39,shown:[false,true,true,false,false,true,false],rs:true,total:4}
];
let correct=0;for(const x of trend){const a=evaluateTrend(x).slice(0,7);for(let i=0;i<7;i++)if(a[i]===x.shown[i])correct++;assert.deepEqual(a,x.shown);assert.equal(a.filter(Boolean).length+Number(x.rs),x.total);console.log(`TREND ${x.name}: ${a.filter(Boolean).length}/7 known, RS shown=${x.rs}, total shown=${x.total}/8`)}
console.log(`TREND conditions ${correct}/${trend.length*7}; RS cannot be independently computed`);
for(const x of [{name:'SOXX',close:155.41,sma200:159.94,sma5:143.44,rsi:89,shown:'wait',exit:true},{name:'AAON',close:76.33,sma200:96.47,sma5:65.16,rsi:93.8,shown:'wait',exit:true}]){const y=classifyRsi2(x);assert.equal(y.status,x.shown);assert.equal(y.exit,x.exit);console.log(`RSI2 ${x.name}: ${y.status}, exit=${y.exit}`)}
for(const x of [{name:'NVDA 11-11',entry:226,atr:8.05,shownStop:209.89,shownUnit:124},{name:'NVDA 11-10',entry:228.64,atr:8.02,shownStop:212.60,shownUnit:124},{name:'MU 11-11',entry:990,atr:58.23,shownStop:873.54,shownUnit:17}]){const p=calculatePosition({...x,riskPercent:2});assert.equal(p.unit,x.shownUnit);console.log(`BREAKOUT ${x.name}: unit ${p.unit}/${x.shownUnit}; stop ${p.stop.toFixed(2)}/${x.shownStop.toFixed(2)} delta ${(p.stop-x.shownStop).toFixed(2)} (${(Math.abs(p.stop-x.shownStop)/x.shownStop*100).toFixed(4)}%)`)}
console.log('Rounded inputs may differ from the originals; comparisons do not verify the indicators computed from raw bars.');
