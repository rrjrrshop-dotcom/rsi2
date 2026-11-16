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
