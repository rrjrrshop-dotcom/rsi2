import {renderScoreCard,renderScoreGraphic} from './score-card.mjs';
import {guidanceElement} from './strategy-guidance.mjs';
const ids=['1000','trend','box','rsi2','breakout'];
let saved,loadedAt=0, pending;
async function readSaved(code){
 if(saved&&Date.now()-loadedAt<60000)return saved;
 if(!pending)pending=window.authorizedFetch('/api/korea-five',{},code).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'국내 저장본을 읽지 못했습니다.');saved=data;loadedAt=Date.now();return data}).finally(()=>{pending=null});
 return pending;
}
const panels=[];
function make(id,parent){
 const section=document.createElement('details');section.className='panel extra';
 const summary=document.createElement('summary');summary.textContent='한국 시총 상위 5개 기업 · '+id;
 const status=document.createElement('p'),list=document.createElement('div'),load=document.createElement('button');
 load.type='button';load.textContent='국내 저장본 불러오기';
 status.textContent='보통주 기준 · 원화 · 직전 완료 거래일 일봉';
 section.append(summary,status,load,list);parent.append(section);
 const render=async()=>{
 try{
 const code=window.storedCode()||document.getElementById('pairCode').value.trim();
 if(!code)throw Error('개인 등록 코드를 먼저 입력하세요.');
 await readSaved(code);
 list.replaceChildren();status.textContent=saved.through+' 한국 확정 일봉 · 시총 순위 확인 '+saved.rankedAt;
 for(const [index,row] of saved.rows.entries()){
 const details=document.createElement('details'),heading=document.createElement('summary');
 heading.append(document.createTextNode((index+1)+'. '+row.name+' ('+row.symbol+') · '),renderScoreGraphic(row.scores[id],{compact:true}));
 const cap=document.createElement('p');cap.textContent='시가총액 '+row.marketCap.toLocaleString('ko-KR')+'원';
 details.append(heading,cap,renderScoreCard(row.scores[id],{listsOnly:true}),guidanceElement(id,row.scores[id],'recommend'));
 list.append(details);
 }
 }catch(error){status.textContent=error.message}
 };
 load.onclick=render;section.addEventListener('toggle',()=>{if(section.open)render()});
 panels.push({section,render});
 document.getElementById('tab-'+id)?.addEventListener('click',()=>{section.open=true;render()});
}
for(const id of ids)make(id,document.getElementById('strategy-'+id));
const help=document.getElementById('strategy-help'),group=document.createElement('section');group.className='panel';
const title=document.createElement('h2');title.textContent='한국 시총 상위 5개 기업';group.append(title);

const status=document.createElement('p'),list=document.createElement('div'),refresh=document.createElement('button');
group.id='korea-five-summary';
refresh.type='button';refresh.textContent='국내 저장본 불러오기';
group.append(status,refresh,list);help.append(group);
async function renderSummary(){
 try{
 const code=window.storedCode()||document.getElementById('pairCode').value.trim();
 if(!code)throw Error('개인 등록 코드를 먼저 입력하세요.');
 const data=await readSaved(code);
 list.replaceChildren();status.textContent=data.through+' 확정 일봉 · 원화 · 시총 순위 확인 '+data.rankedAt;
 for(const [index,row] of data.rows.entries()){
  const article=document.createElement('article'),name=document.createElement('h3'),meta=document.createElement('p'),strip=document.createElement('div');
  article.className='panel';article.dataset.koreanSymbol=row.symbol;
  name.textContent=(index+1)+'. '+row.name+' ('+row.symbol+')';
  meta.textContent='시가총액 '+row.marketCap.toLocaleString('ko-KR')+'원';
  strip.className='holding-scores';strip.style.cssText='display:flex;flex-wrap:wrap;gap:.5rem';
  const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='전략별 조건과 안내';
  detail.append(summary);
  for(const id of ids){
   const chip=document.createElement('span'),label=document.createElement('small');
   label.textContent=id==='rsi2'?'RSI2':id;
   chip.append(label,renderScoreGraphic(row.scores[id],{compact:true}));strip.append(chip);
   const block=document.createElement('section'),heading=document.createElement('h4');heading.textContent=label.textContent;
   block.append(heading,renderScoreCard(row.scores[id],{listsOnly:true}),guidanceElement(id,row.scores[id],'recommend'));detail.append(block);
  }
  article.append(name,meta,strip,detail);list.append(article);
 }
 }catch(error){status.textContent=error.message}
}
refresh.onclick=()=>{saved=null;renderSummary()};
document.getElementById('tab-help').addEventListener('click',renderSummary);
if(!help.hidden)renderSummary();

