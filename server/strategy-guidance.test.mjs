import {test} from 'node:test';import assert from 'node:assert/strict';import {strategyGuidance} from '../strategy-guidance.mjs';
test('holding exits precede entry guidance and unknown conditions remain explicit',()=>{
 const score={conditions:[{label:'종가 > 200일선',passed:false,value:'90 / 100'},{label:'상대강도',passed:null}],exitConditions:[{label:'종가 < EMA55',passed:true,value:'90 / 95'}]};
 assert.match(strategyGuidance('1000',score,'holding'),/청산 참고 조건.*90 \/ 95/);
 assert.match(strategyGuidance('trend',score,'watch'),/미확인 조건 상대강도/);
 assert.match(strategyGuidance('trend',score,'recommend'),/다음 확인 조건 종가 > 200일선/);
 assert.match(strategyGuidance('box',null),/부족/);
});