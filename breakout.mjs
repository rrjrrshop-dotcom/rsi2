export function calculatePosition({entry,atr,allocation=100000,riskPercent=1}) {
 const unit=Math.floor(allocation*(riskPercent/100)/(2*atr)),stop=entry-2*atr;
 return {unit,stop};
}
/** Completed daily bars only. Channels exclude the bar being evaluated. */
export function analyzeBreakout(bars,{allocation=100000,riskPercent=1,includeLines=true}={}) {
 if(!Array.isArray(bars)||bars.length<56)throw Error('최소 56거래일의 일봉이 필요합니다.');
 if(!Number.isFinite(riskPercent)||riskPercent<=0||riskPercent>2)throw Error('손실 비율은 0 초과 2% 이하여야 합니다.');
 if(!Number.isFinite(allocation)||allocation<=0)throw Error('배분액은 0보다 커야 합니다.');
 for(const b of bars)if(![b.open,b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.high<b.low||b.close<=0)throw Error('유효한 일봉 가격이 필요합니다.');
 const channel=(end,n,key,fn)=>fn(...bars.slice(end-n,end).map(b=>b[key]));
 let atr=null;const trs=bars.map((b,i)=>i?Math.max(b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)):b.high-b.low);
 if(trs.length<20)throw Error('ATR 계산 데이터가 부족합니다.');
 atr=trs.slice(0,20).reduce((a,b)=>a+b,0)/20;for(let i=20;i<trs.length;i++)atr=(atr*19+trs[i])/20;
 if(!(atr>0))throw Error('ATR이 0이어서 수량을 계산할 수 없습니다.');
 const i=bars.length-1,b=bars[i],high20=channel(i,20,'high',Math.max),high55=channel(i,55,'high',Math.max),low10=channel(i,10,'low',Math.min),low20=channel(i,20,'low',Math.min);
 const signals = {
  s1: b.close > high20, s2: b.close > high55,
  exitS1: b.close < low10, exitS2: b.close < low20,
 };
 const state=signals.s2?'both':signals.s1?'s1':signals.exitS2?'down':'wait';
 const entry=state==='both'||state==='s1'?b.close:high20,{unit,stop}=calculatePosition({entry,atr,allocation,riskPercent}),levels=[0,.5,1,1.5].map(x=>entry+x*atr),costs=levels.map(p=>p*unit);let sum=0,affordable=0;for(const cost of costs){if(unit>0&&sum+cost<=allocation){sum+=cost;affordable++}else break}
 const lines=includeLines?bars.map((_,j)=>j<55?null:{high20:channel(j,20,'high',Math.max),high55:channel(j,55,'high',Math.max),low10:channel(j,10,'low',Math.min),low20:channel(j,20,'low',Math.min)}):[];
 return {bars,date:b.date,close:b.close,atr,high20,high55,low10,low20,signals,state,entry,unit,stop,levels,costs,total:costs.reduce((a,c)=>a+c,0),affordable,allocation,riskPercent,lines};
}
