import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alertPlan} from './stocking-alerts.mjs';
import {normalizePhone} from './sms.mjs';

test('recent holdings exit alerts precede watch conditions and new recommendations',()=>{
 const date='2026-11-13';
 const row={symbol:'ABC',scores:{rsi2:{conditions:[{passed:true}],exitConditions:[{passed:true,label:'종가 > 5일선'}]}}};
 const result={expectedDate:date,preliminary:{
  recommendationScreen:{version:2,scope:'nasdaq100-sp500-dow',status:'applied',through:date},
  recommendations:{rsi2:[{symbol:'ABC',date}]},
 }};
 const opts={result,rows:[row],holdings:new Set(['ABC']),watch:new Set(['ABC'])};
 const initial=alertPlan(opts);
 assert.deepEqual(initial.jobs.map(job=>job.type),['holding','watch']);
 const changed=alertPlan({...opts,previous:{recommended:[]}});
 assert.deepEqual(changed.jobs.map(job=>job.type),['holding','watch','recommend']);
 assert.deepEqual(alertPlan({...opts,previous:changed.next}).jobs,[]);
 const cleared=alertPlan({...opts,rows:[{...row,scores:{rsi2:{conditions:[{passed:false}],exitConditions:[{passed:false,label:'종가 > 5일선'}]}}}],previous:changed.next});
 assert.deepEqual(alertPlan({...opts,previous:cleared.next}).jobs.map(job=>job.type),['holding','watch']);
});

test('normalize a Korean mobile or international SMS number without permitting extension syntax',()=>{
 assert.equal(normalizePhone('010-1234-5678'),'+821012345678');
 assert.equal(normalizePhone('+1 (202) 555-0101'),'+12025550101');
 assert.throws(()=>normalizePhone('010-1234-5678;999'),/전화번호/);
});

test('holding entry requires an exact 100 and re-arms after a lower score', () => {
 const holdings=new Set(['ABC']), watch=new Set();
 const result={expectedDate:'2026-11-16'};
 function run(passed, previous, total=10){
  const scores=passed===null?{}:{trend:{passed,total,exitConditions:[]}};
  return alertPlan({result,rows:[{symbol:'ABC',scores}],holdings,watch,previous});
 }
 const below=run(7,undefined,8);
 assert.deepEqual(below.jobs,[]);
 const ninety=run(9,below.next);
 assert.deepEqual(ninety.jobs,[]);
 const roundedTo100=run(1999,ninety.next,2000);
 assert.deepEqual(roundedTo100.jobs,[]);
 const first=run(10,roundedTo100.next);
 assert.deepEqual(first.jobs.map(job=>job.type),['holdingEntry']);
 assert.match(first.jobs[0].body,/ABC trend 10\/10점 · 100점/);
 assert.deepEqual(run(10,first.next).jobs,[]);
 const missing=run(null,first.next);
 assert.deepEqual(run(10,missing.next).jobs,[]);
 const cleared=run(8,first.next);
 assert.match(run(10,cleared.next).jobs[0].body,/100점/);
});

test('holding entry keeps every strategy and skips unregistered symbols', () => {
 const scores=Object.fromEntries(['1000','trend','box','rsi2','breakout']
  .map(strategy=>[strategy,{passed:2,total:2,exitConditions:[]}]));
 const {jobs}=alertPlan({result:{expectedDate:'2026-11-16'},
  rows:[{symbol:'ABC',scores},{symbol:'XYZ',scores}],holdings:new Set(['ABC']),watch:new Set()});
 assert.deepEqual(jobs.map(job=>job.id),['holdingEntry-0','holdingEntry-1']);
 const text=jobs.map(job=>job.body).join(' ');
 for(const caption of ['1000','trend','box','RSI2','breakout'])assert.ok(text.includes('ABC '+caption+' '));
 assert.ok(!text.includes('XYZ'));
});
