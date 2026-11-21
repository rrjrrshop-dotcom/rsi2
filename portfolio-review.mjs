
const panel=document.getElementById('holdings-settings');
const table=document.getElementById('holdings');
const overview=document.createElement('section');
overview.className='panel';
overview.setAttribute('aria-label','보유 현황 분석');
panel.insertBefore(overview,panel.querySelector('form'));
const labels={nasdaq100:'나스닥100',sp500:'S&P500',dow:'다우'};
let latest=new Map(),recommendations=new Map(),requested='',busy=false;
function badge(text,help){
 const box=document.createElement('span'),button=document.createElement('button'),tip=document.createElement('span');
 button.type='button';button.className='secondary';button.textContent=text;button.setAttribute('aria-expanded','false');
 tip.hidden=true;tip.setAttribute('role','status');tip.textContent=help;tip.style.cssText='display:none;max-width:28rem;white-space:normal;padding:.7rem;border:1px solid #80b4a7;border-radius:.7rem';
 button.onclick=()=>{tip.hidden=!tip.hidden;tip.style.display=tip.hidden?'none':'block';button.setAttribute('aria-expanded',String(!tip.hidden))};
 box.append(button,tip);return box;
}
function paint(){
 const holdings=window.stockingHoldings.read(),days=[];
 let exited=0;
 for(const row of table.rows){
  const cell=row.cells[0],symbol=cell?.dataset.symbol;if(!symbol)continue;
  cell.querySelector('.portfolio-context')?.remove();
  const data=latest.get(symbol),position=holdings.find(p=>p.symbol===symbol),context=document.createElement('div');
  context.className='portfolio-context';
  if(position?.buyDate){
   const held=Math.floor((Date.now()-Date.parse(position.buyDate+'T00:00:00+09:00'))/86400000);
   if(held>=0){days.push(held);context.append(document.createTextNode('매수 '+position.buyDate+' · '+held+'일 보유 · '))}
  }else{
   const date=document.createElement('input');date.type='date';date.setAttribute('aria-label',symbol+' 매수일');
   date.onchange=()=>{window.stockingHoldings.save(holdings.map(p=>p.symbol===symbol?{...p,buyDate:date.value}:p))};
   context.append(document.createTextNode('매수일 미등록 '),date);
  }
  const company=data?.company;
  context.append(document.createTextNode(company?company.name+' · 시총 '+(company.marketCap?'$'+company.marketCap.toLocaleString('en-US'):'자료 부족')+' · '+company.financials+' · '+(company.indexes.map(x=>labels[x]).join(' / ')||'3대 지수 소속 미확인'):' · 기업·재무 자료 수집 대기'));
  const exits=Object.entries(data?.scores??{}).flatMap(([id,s])=>s.exitConditions.filter(x=>x.passed===true).map(x=>id+' '+x.label));
  if(exits.length){exited++;context.append(badge('🔴 매도','확정 일봉에서 '+exits.join(' · ')+' 충족. 이미 이탈한 경우 현재 종가와 기준선의 거리를 확인하고, 보유 비중 축소 또는 청산 계획을 검토하세요. 급변·갭에서는 표시 가격으로 체결되지 않을 수 있습니다.'))}
  cell.append(context);
 }
 overview.replaceChildren();
 const title=document.createElement('h3');title.textContent='보유 현황과 매매 참고';
 const text=document.createElement('p');
 const avg=days.length?Math.round(days.reduce((a,b)=>a+b,0)/days.length):null;
 text.textContent=holdings.length+'종목 · '+(avg===null?'매수일을 입력하면 보유기간을 분석합니다.':'날짜 등록 '+days.length+'종목 평균 '+avg+'일 보유. '+(avg<20?'최근 매수 비중이 있어 RSI2의 짧은 반등 조건과 손절 계획을 함께 확인하세요.':'보유기간이 길어 trend의 장기선과 1000의 EMA55 이탈을 함께 확인하세요.'))+' 청산 참고 조건 '+exited+'종목. 현재 보유 목록으로 관측한 성향이며 매도 이력이 없어 실제 매매 성향은 미확정입니다.';
 overview.append(title,text);
 const caution=document.createElement('p');caution.textContent='재무 기준 미달·자료 부족 종목은 추가 매수 전에 공시를 확인하세요. 섹터 정보가 확보되지 않은 경우 섹터 적합성 판단은 자료 부족으로 표시합니다.';
 overview.append(caution);
 const picks=[...recommendations].filter(([,ids])=>ids.size>=2);
 const p=document.createElement('p');p.textContent='복수 전략 후보 · '+(picks.map(([s])=>s).join(', ')||'현재 확인된 후보 없음');overview.append(p);
 for(const root of document.querySelectorAll('.recommend-items,.strategy-recommendations')){
  for(const strong of root.querySelectorAll('strong')){
   const symbol=strong.textContent.trim(),ids=recommendations.get(symbol);
   if(ids?.size>=2&&!strong.parentElement.nextElementSibling?.matches('[data-multi-recommend]')){
    const b=badge('⭐ 추천',[...ids].join(' · ')+' 전략 추천에 함께 포함됐습니다. 상세 조건과 돌파·지지선을 확인하세요. 기준선에서 크게 멀어진 경우 추격 진입보다 재접근 여부와 허용 손실을 먼저 검토하세요.');
    b.dataset.multiRecommend='true';strong.parentElement.after(b);
   }
  }
 }
}
async function refresh(){
 if(busy||!panel.open)return;
 const positions=window.stockingHoldings.read(),key=JSON.stringify(positions);
 if(key===requested)return;
 const code=window.storedCode()||document.getElementById('pairCode').value.trim();
 if(!code){paint();return}
 busy=true;
 try{
  const gathered=new Map();
  for(let i=0;i<positions.length;i+=24){
   const r=await window.authorizedFetch('/api/holding-scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:positions.slice(i,i+24).map(p=>p.symbol)})},code);
   const data=await r.json();if(!r.ok)throw Error(data.error);
   for(const item of data.rows)gathered.set(item.symbol,item);
  }
  const response=await window.authorizedFetch('/api/results',{},code),data=await response.json();
  if(response.ok){
   recommendations=new Map();
   for(const list of [data.preliminary?.recommendations,data.preliminary?.marketRecommendations])
    for(const [id,rows] of Object.entries(list??{}))for(const item of rows){
     if(item.date!==data.expectedDate)continue;
     if(!recommendations.has(item.symbol))recommendations.set(item.symbol,new Set());
     recommendations.get(item.symbol).add(id);
    }
  }
  latest=gathered;requested=key;paint();
 }catch(error){overview.textContent='보유 분석을 읽지 못했습니다. '+error.message}
 finally{busy=false}
}
new MutationObserver(()=>{paint();refresh()}).observe(table,{childList:true});
panel.addEventListener('toggle',refresh);
document.querySelectorAll('[data-strategy]').forEach(tab=>tab.addEventListener('click',()=>setTimeout(paint,600)));
paint();refresh();
