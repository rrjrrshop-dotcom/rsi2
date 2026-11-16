import {waveState,historicalWaveRates} from './wave-analysis.mjs';
const dialog=document.getElementById('holdingWave');
const title=document.getElementById('waveTitle'), status=document.getElementById('waveStatus');
const canvas=document.getElementById('waveChart'), stats=document.getElementById('waveRates');
const fmt=n=>n.toLocaleString('en-US',{maximumFractionDigits:2});
let request=0;

function draw(bars,state){
 const ctx=canvas.getContext('2d');
 const start=Math.max(0,Math.min(bars.length-110,(state.points[0]??bars.length)-4));
 const shown=bars.slice(start), prices=shown.map(b=>b.close);
 if(state.invalid!==undefined)prices.push(state.invalid);
 const low=Math.min(...prices),span=Math.max(...prices)-low||1;
 const x=i=>52+(i-start)*682/Math.max(1,shown.length-1);
 const y=p=>278-(p-low)*238/span;
 ctx.fillStyle='#111d27';ctx.fillRect(0,0,780,325);
 ctx.font='14px sans-serif';ctx.textBaseline='middle';
 for(let i=0;i<5;i++){
  const price=low+span*i/4;
  ctx.strokeStyle='#314454';
  ctx.beginPath();ctx.moveTo(50,y(price));ctx.lineTo(742,y(price));ctx.stroke();
  ctx.fillStyle='#b8cbd5';ctx.fillText(fmt(price),4,y(price));
 }
 ctx.strokeStyle='#85a9bf';ctx.lineWidth=2;ctx.beginPath();
 shown.forEach((b,i)=>i?ctx.lineTo(x(start+i),y(b.close)):ctx.moveTo(x(start+i),y(b.close)));
 ctx.stroke();
 if(state.points.length){
  ctx.strokeStyle='#80e8c3';ctx.lineWidth=3;ctx.beginPath();
  state.points.forEach((i,j)=>j?ctx.lineTo(x(i),y(bars[i].close)):ctx.moveTo(x(i),y(bars[i].close)));
  ctx.stroke();
  ctx.fillStyle='#b4f5df';ctx.font='bold 19px sans-serif';
  state.points.forEach((i,j)=>ctx.fillText('012345ABC'[j],x(i)-6,y(bars[i].close)-19));
  ctx.setLineDash([7,5]);ctx.strokeStyle='#ffae91';ctx.lineWidth=1.6;ctx.beginPath();
  ctx.moveTo(50,y(state.invalid));ctx.lineTo(742,y(state.invalid));ctx.stroke();ctx.setLineDash([]);
 }
 ctx.fillStyle='#b8cbd5';ctx.font='14px sans-serif';
 ctx.fillText(shown[0].date,52,305);ctx.fillText(shown.at(-1).date,660,305);
 canvas.hidden=false;
}

async function open(symbol,date,codeField='pairCode'){
 const version=++request;
 title.textContent=symbol+' · 엘리어트 파동 후보';
 status.textContent='저장된 확정 일봉을 읽는 중입니다…';
 canvas.hidden=true;stats.replaceChildren();
 if(!dialog.open)dialog.showModal();
 try{
  const code=window.accessCode(codeField);
  const params=new URLSearchParams({symbol});
  if(date)params.set('through',date);
  const response=await window.authorizedFetch('/api/quote?'+params,{},code);
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'일봉을 읽지 못했습니다.');
  if(version!==request||!dialog.open)return;
  const bars=data.bars.filter(b=>Number.isFinite(b.close)&&b.close>0);
  if(!bars.length)throw Error('저장된 일봉이 없습니다.');
  const state=waveState(bars);
  draw(bars,state);
  status.textContent=state.stage
   ? `${data.through} 종가 · ${state.direction>0?'상승':'하락'} 구조 ${state.stage}파 후보 · 종가가 $${fmt(state.invalid)}에 도달하거나 ${state.side>0?'웃돌면':'밑돌면'} 해석 무효`
   : `${data.through} 종가 · 규칙에 맞는 파동 후보를 찾지 못했습니다.`;
  for(const row of historicalWaveRates(bars,state)){
   const li=document.createElement('li');
   li.textContent=`${row.horizon}거래일 뒤 · ${row.available?`상승 ${(100*row.up/row.n).toFixed(1)}% · 하락 ${(100*row.down/row.n).toFixed(1)}% · 보합 ${(100*row.flat/row.n).toFixed(1)}% · 표본 ${row.n}건`:`자료 부족 (표본 ${row.n}건, 최소 12건)`}`;
   stats.append(li);
  }
 }catch(error){if(version===request)status.textContent=error.message}
}
document.getElementById('strategy-help').addEventListener('click',event=>{
 const button=event.target.closest('[data-wave-symbol]');
 if(button)open(button.dataset.waveSymbol,button.dataset.waveDate,button.dataset.waveCodeField);
});
