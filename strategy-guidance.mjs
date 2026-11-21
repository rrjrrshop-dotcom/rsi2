
const names={'1000':'1000',trend:'trend',box:'box',rsi2:'RSI2',breakout:'breakout'};
export function strategyGuidance(id,score,kind='watch'){
 if(!score?.conditions?.length)return '저장된 일봉 또는 조건 자료가 부족합니다. 최신 기준일과 입력 자료를 확인하세요.';
 const exits=(score.exitConditions??[]).filter(c=>c.passed===true);
 const failed=score.conditions.filter(c=>c.passed===false);
 const unknown=score.conditions.filter(c=>c.passed==null);
 const level=score.conditions.find(c=>c.value)?.value??'상세 조건 수치';
 const prefix=names[id]+' · ';
 if(kind==='holding'&&exits.length)return prefix+'청산 참고 조건 '+exits.map(c=>c.label+(c.value?' ['+c.value+']':'')).join(' · ')+'. 다음 확인은 기준선 회복 여부와 최근 종가입니다. 이미 이탈했다면 보유 목적과 허용 손실에 따라 비중 축소·청산 계획을 검토하세요.';
 const purpose={rsi2:'상승 추세 안의 단기 과매도 반등',trend:'장기 추세 확인','1000':'하이킨아시와 EMA의 방향 확인',box:'박스 상단과 거래량 확인',breakout:'20·55일 고점 돌파 확인'}[id];
 const condition=failed.length?'다음 확인 조건 '+failed.map(c=>c.label).join(' · '):'현재 확인 가능한 진입 조건 충족';
 const exit=(score.exitConditions??[]).map(c=>c.label+(c.value?' ['+c.value+']':'')).join(' · ');
 return prefix+purpose+'. '+condition+'. 비교 수치 '+level+'. '+
  (unknown.length?'미확인 조건 '+unknown.map(c=>c.label).join(' · ')+'. ':'')+
  (kind==='holding'?'보유 전략이 맞는지 확인하고 ':'진입 전 기준선과의 거리를 확인하고 ')+
  '급등으로 기준선에서 멀어졌다면 재접근 여부를 확인하세요.'+(exit?' 청산 참고 '+exit+'.':'');
}
export function guidanceElement(id,score,kind){
 const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');
 details.className='strategy-guidance';summary.textContent=kind==='holding'?'보유 전략 안내':kind==='recommend'?'추천 종목 전략 안내':'관심 종목 전략 안내';
 text.textContent=strategyGuidance(id,score,kind);details.append(summary,text);return details;
}
