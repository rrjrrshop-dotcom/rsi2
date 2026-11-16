import {renderScoreGraphic} from './score-card.mjs';
const ids=['1000','trend','box','rsi2','breakout'];
const names={'1000':'1000',trend:'trend',box:'box',rsi2:'RSI2',breakout:'breakout'};
const $=id=>document.getElementById(id);
const settings=$('notification-settings'), scoresPanel=$('holdings-settings'), table=$('holdings');
const holdings=()=>window.stockingHoldings.read();
const code=()=>window.storedCode()||$('pairCode').value.trim();

async function request(path,method,body) {
 const secret=code();
 if(!secret)throw Error('1. 알림 설정에서 개인 등록 코드를 입력하세요.');
 const response=await window.authorizedFetch(path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},secret);
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'설정을 불러오지 못했습니다.');
 return result;
}

function watchList(){
 try{const list=JSON.parse(localStorage.getItem('stocking_watchlist_v1')??'[]');return Array.isArray(list)?list:[]}
 catch{return []}
}

async function saveSettings(phone){
 const status=$('alertSettingsStatus');
 try{
  const data=await request('/api/alert-settings','PUT',{holdings:holdings().map(item=>item.symbol),watch:watchList(),
   ...(phone!==undefined&&{phone})});
  $('alertPhone').value='';
  status.textContent=`보유 ${data.holdings}개 · 관심 ${data.watch}개 알림 저장`+
   (data.phone?` · 문자 번호 ${data.phone} ${data.smsReady?'· 발송 설정 완료':'· 발송 서비스 연결 및 번호 확인 대기'}`:' · 등록된 문자 번호 없음');
 }catch(error){status.textContent=error.message}
}
$('syncHoldings').onclick=()=>saveSettings();
$('saveAlertPhone').onclick=()=>{
 const phone=$('alertPhone').value.trim();
 if(!phone){$('alertSettingsStatus').textContent='문자를 받을 전화번호를 입력하세요.';return}
 saveSettings(phone);
};
$('removeAlertPhone').onclick=()=>saveSettings('');

async function showSettings(){
 if(!settings.open||!code())return;
 try{
  const info=await request('/api/alert-settings','GET');
  $('alertSettingsStatus').textContent=`보유 ${info.holdings}개 · 관심 ${info.watch}개 알림 등록`+
    (info.phone?` · 문자 번호 ${info.phone} ${info.smsReady?'· 발송 설정 완료':'· 발송 서비스 연결 및 번호 확인 대기'}`:'');
 }catch(error){$('alertSettingsStatus').textContent=error.message}
}
settings.addEventListener('toggle',showSettings);
showSettings();

let scoreRows=new Map(), lastKey='', lastRead=0, sequence=0;
function paint(){
 for(const tr of table.rows){
  const cell=tr.cells[0];
  if(!cell)continue;
  const symbol=cell.dataset.symbol??cell.textContent;
  cell.dataset.symbol=symbol;
  cell.querySelector('.holding-scores')?.remove();
  const item=scoreRows.get(symbol);
  const strip=document.createElement('span');
  strip.className='holding-scores';
  strip.setAttribute('aria-label',symbol+' 최신 전략 스코어');
  for(const id of ids){
   const score=item?.scores[id], chip=document.createElement('span'), label=document.createElement('small');
   label.textContent=names[id];
   chip.append(label);
   if(score) chip.append(renderScoreGraphic(score,{compact:true}));
   else chip.append(document.createTextNode('—'));
   strip.append(chip);
  }
  cell.append(strip);
  if(!item?.date)continue;
  const position=holdings().find(row=>row.symbol===symbol);
  if(!position)continue;
  tr.cells[3].textContent=item.close.toFixed(2)+' ('+item.date+')';
  tr.cells[4].textContent=((item.close-position.price)*position.qty).toFixed(2);
  tr.cells[5].textContent=((item.close/position.price-1)*100).toFixed(2)+'%';
  const exits=ids.filter(id=>item.scores[id]?.exitConditions.some(condition=>condition.passed===true));
  tr.cells[6].textContent=exits.length?exits.map(id=>names[id]).join(' · '):'—';
 }
}
async function refresh(force=false){
 if(!scoresPanel.open)return;
 const symbols=holdings().map(item=>item.symbol);
 const key=JSON.stringify(symbols);
 if(!force&&lastKey===key&&Date.now()-lastRead<60000){paint();return}
 const stamp=++sequence, status=$('holdingScoreStatus');
 if(!symbols.length){status.textContent='보유 종목을 추가하면 최신 스코어가 표시됩니다.';scoreRows=new Map();paint();return}
 status.textContent='저장된 최신 일봉의 스코어를 읽는 중입니다…';
 try{
  const gathered=new Map();
  let date;
  for(let i=0;i<symbols.length;i+=24){
   const data=await request('/api/holding-scores','POST',{symbols:symbols.slice(i,i+24)});
   if(stamp!==sequence)return;
   if(date&&data.date!==date)throw Error('일봉 갱신 중입니다. 스코어를 다시 불러오세요.');
   date=data.date;
   for(const row of data.rows)gathered.set(row.symbol,row);
  }
  scoreRows=gathered;lastKey=key;lastRead=Date.now();paint();
  const missing=[...gathered.values()].filter(row=>Object.keys(row.scores).length<ids.length).length;
  status.textContent=`${date} 확정 일봉 · ${symbols.length}종목${missing?` · ${missing}종목 일부 데이터 부족`:''}`;
 }catch(error){if(stamp===sequence)status.textContent=error.message}
}
new MutationObserver(()=>{paint();refresh()}).observe(table,{childList:true});
scoresPanel.addEventListener('toggle',()=>{paint();refresh()});
$('loadHoldingScores').onclick=()=>refresh(true);
window.addEventListener('focus',()=>refresh());
paint();refresh();
