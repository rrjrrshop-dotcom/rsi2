import {compareScores, scoreName, scoreStrategy} from './scores.mjs';
import {renderScoreCard, renderScoreGraphic} from './score-card.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_INDEXES, RECOMMENDATION_LIMIT, RECOMMENDATION_SCOPES} from './recommendation-policy.mjs';
import {BREAKOUT_ADJUSTMENT} from './breakout.mjs';
const ids=['1000','trend','box','rsi2','breakout'],key='stocking_watchlist_v1',codeKey='rsi2_device_code_v1';
const cfg={'1000':{form:'n1000Form',symbol:'n1000Symbol',code:'n1000Code',result:'n1000Summary',chart:'n1000Chart'},trend:{form:'trendForm',symbol:'trendSymbol',code:'trendCode',result:'trendResult',chart:'trendChart'},box:{form:'boxForm',symbol:'boxSymbol',code:'boxCode',result:'boxResult',chart:'boxChart'},rsi2:{form:'symbolForm',symbol:'lookupSymbol',code:'lookupCode',result:'quickResult',chart:'priceChart'},breakout:{form:'breakoutForm',symbol:'breakoutSymbol',code:'breakoutCode',result:'breakoutResult',chart:'breakoutChart'}};
const $=id=>document.getElementById(id);let watch=[];try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))watch=[...new Set(saved.filter(s=>typeof s==='string'&&/^[A-Z0-9.\-]{1,15}$/.test(s)))].slice(0,10)}catch{}let generation=0;const cache=new Map();
function codeFor(id){return localStorage.getItem(codeKey)||$(cfg[id].code).value.trim()}
function save(){localStorage.setItem(key,JSON.stringify(watch))}
function el(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n}
function selected(){return document.querySelector('[data-strategy][aria-selected="true"]')?.dataset.strategy||'rsi2'}
function openDetail(id, symbol, recommendation) {
 const c = cfg[id];
 const panel = $('strategy-' + id);
 $(c.symbol).value = symbol;
 for (const section of [...panel.children].filter(node => node.matches('section, details'))) {
  section.dataset.detailHidden = section.hidden ? '1' : '0';
  section.hidden = true;
 }
 const form = $(c.form);
 form.closest('section').hidden = false;
 $(c.result).closest('section').hidden = false;
 if (id === 'rsi2') $(c.chart).closest('section').hidden = false;
 panel.querySelector('.detail-back').hidden = false;
 form.scrollIntoView({behavior: 'smooth', block: 'start'});
 if (recommendation?.date) {
  form.dataset.recommendationDate = recommendation.date;
  form.dataset.recommendationAdjustment = recommendation.adjustment ?? '';
 }
 try { form.requestSubmit(); }
 finally {
  delete form.dataset.recommendationDate;
  delete form.dataset.recommendationAdjustment;
 }
}
function back(id){const panel=$('strategy-'+id);[...panel.children].filter(n=>n.dataset.detailHidden!==undefined).forEach(n=>{n.hidden=n.dataset.detailHidden==='1';delete n.dataset.detailHidden});panel.querySelector('.detail-back').hidden=true}
function renderRows(id, rows, container, removable = false, waveCodeField) {
 container.replaceChildren();
 for (const item of rows) {
  const wrap = el(removable ? 'div' : 'article');
  wrap.className = removable ? 'watch-item' : 'recommend-item';
  const open = el('button');
  open.type = 'button';
  open.className = removable ? 'watch-open' : 'recommend-open';
  open.append(el('strong',item.symbol), renderScoreGraphic(item, {compact:true}));
  if (item.error) open.title = item.error;
  if (waveCodeField) {
   open.dataset.waveSymbol = item.symbol;
   open.dataset.waveDate = item.date;
   open.dataset.waveCodeField = waveCodeField;
   open.setAttribute('aria-label', item.symbol + ' 엘리어트 파동 보기');
  } else {
   open.onclick = () => openDetail(id, item.symbol, removable ? undefined : item);
  }
  wrap.append(open);
  if (removable) {
   const remove = el('button','삭제');
   remove.type = 'button';
   remove.setAttribute('aria-label',item.symbol+' 삭제');
   remove.onclick = () => {
    watch = watch.filter(symbol => symbol !== item.symbol);
    cache.delete(item.symbol);
    cache.delete('breakout:' + item.symbol);
    save();
    refreshWatch(id);
   };
   wrap.append(remove);
  } else {
   if (item.indexes?.length) {
    const membership = el('p', item.indexes.map(index => RECOMMENDATION_INDEXES[index]).join(' · '));
    membership.className = 'recommend-indexes';
    wrap.append(membership);
   }
   const details = el('details');
   details.className = 'recommend-conditions';
   details.append(el('summary','조건 자세히'), renderScoreCard(item, {listsOnly:true}));
   if (item.frameComparison) details.append(el('p', item.frameComparison.label));
   wrap.append(details);
  }
  container.append(wrap);
 }
}
async function fetchBars(symbol, code, id) {
 const params = new URLSearchParams({symbol});
 const breakout = id === 'breakout';
 const key = breakout ? 'breakout:' + symbol : symbol;
 const previous = cache.get(key);
 if (previous?.code === code && Date.now() - previous.cachedAt < 300000) return previous.data;
 if (breakout) params.set('strategy', 'breakout');
 const response = await fetch('/api/quote?' + params, {headers: {Authorization: 'Bearer ' + code}, cache: 'no-store'});
 const data = await response.json();
 if (!response.ok) throw Error(data.error || '일봉 조회 실패');
 if (breakout && data.adjustment !== BREAKOUT_ADJUSTMENT) throw Error('배당을 반영한 일봉을 확인할 수 없습니다.');
 cache.set(key, {code, cachedAt: Date.now(), data});
 return data;
}
async function refreshWatch(id){const panel=$('strategy-'+id),list=panel.querySelector('.watch-items'),status=panel.querySelector('.watch-status'),run=++generation,code=codeFor(id);panel.querySelector('.watch-count').textContent=`${watch.length}/10`;if(!watch.length){list.replaceChildren();status.textContent='관심종목을 등록하세요.';return}if(!code){renderRows(id,watch.map(symbol=>({symbol,error:'개인 등록 코드 필요'})),list,true);status.textContent='점수 확인을 위해 개인 등록 코드를 입력하세요.';return}status.textContent='관심종목의 확정 일봉을 확인하는 중…';const result=[];for(const symbol of [...watch]){try{const data=await fetchBars(symbol,code,id),score=scoreStrategy(id,data.bars,symbol);result.push({symbol,...score,date:data.through,stale:data.staleWarning})}catch(e){result.push({symbol,error:e.message})}if(run!==generation)return}result.sort(compareScores);renderRows(id,result,list,true);status.textContent=`충족한 조건 수가 많은 순${result.some(x=>x.stale)?' · 오래된 종가 포함':''}${result.some(x=>x.error)?' · 일부 확인 실패 (요청 한도 또는 데이터 부족)':''}`}
const recommendationState = new Map();
const holdingRecommendations = $('holdingRecommendations');
const holdingRecommendationsPanel = $('recommendation-settings');
const strategyTitles = {'1000':'1000',trend:'trend',box:'box',rsi2:'RSI2',breakout:'breakout'};
const scopeLabels = {
 major: {title: '주요상장사', detail: '나스닥 100 · S&P 500 · 다우'},
 all: {title: '전종목', detail: '미국 상장 보통주 · 시총 상위 80%'},
};

function scopePicker(id, panel, listId) {
 const group = el('div');
 group.className = 'recommend-scope-picker';
 group.setAttribute('role', 'group');
 group.setAttribute('aria-label', '추천 종목 범위');
 for (const [scope, {title, detail}] of Object.entries(scopeLabels)) {
  const button = el('button');
  button.type = 'button';
  button.dataset.recommendationScope = scope;
  button.setAttribute('aria-pressed', String(scope === 'major'));
  button.setAttribute('aria-controls', listId);
  button.setAttribute('aria-label', title);
  button.setAttribute('aria-describedby', `${listId}-scope-${scope}`);
  const image = el('img');
  image.src = `/assets/scopes/${scope}.webp`;
  image.alt = '';
  image.width = image.height = 42;
  const label = el('span');
  const description = el('small', detail);
  description.id = `${listId}-scope-${scope}`;
  label.append(el('strong', title), description);
  button.append(image, label);
  button.onclick = () => {
   const state = recommendationState.get(id);
   if (state.scope === scope) return;
   state.scope = scope;
   for (const view of [state.strategyPanel,state.holdingPanel]) {
    for (const option of view.querySelectorAll('[data-recommendation-scope]')) {
     option.setAttribute('aria-pressed', String(option.dataset.recommendationScope === scope));
    }
   }
   refreshRecommendations(id);
  };
  group.append(button);
 }
 panel.querySelector('h2').after(group);
}

let recentRecommendations;
function savedRecommendations(code, reload) {
 if (!reload && recentRecommendations?.code === code && Date.now() - recentRecommendations.at < 60000) {
  return recentRecommendations.promise;
 }
 const entry = {code, at: Date.now()};
 entry.promise = fetch('/api/results', {headers: {Authorization: 'Bearer ' + code}, cache: 'no-store'})
  .then(async response => {
   const data = await response.json();
   if (!response.ok) throw Error(data.error || '검색 결과 조회 실패');
   return data;
  }).catch(error => {
   if (recentRecommendations === entry) recentRecommendations = undefined;
   throw error;
  });
 recentRecommendations = entry;
 return entry.promise;
}

async function refreshRecommendations(id, reload = false) {
 const state = recommendationState.get(id);
 const views = [state.strategyPanel,state.holdingPanel];
 const strategyCode = codeFor(id);
 const codeField = strategyCode ? cfg[id].code : 'pairCode';
 const code = strategyCode || $('pairCode').value.trim();
 const setStatus = message => {
  for (const panel of views) panel.querySelector('.recommend-status').textContent = message;
 };
 const requestVersion = ++state.version;
 const scope = state.scope;
 for (const panel of views) panel.querySelector('.recommend-items').replaceChildren();
 if (!code) {
  setStatus('개인 등록 코드를 입력하면 최신 저장 결과를 불러옵니다.');
  return;
 }
 setStatus('최근 저장된 검색 결과를 확인하는 중…');
 try {
  const data = await savedRecommendations(code, reload);
  if (requestVersion !== state.version) return;
  if (!hasCurrentRecommendationScreen(data, scope)) {
   setStatus(`${scopeLabels[scope].title} 범위의 최신 검색 결과를 기다리고 있습니다.`);
   return;
  }
  const stored = data.preliminary?.[RECOMMENDATION_SCOPES[scope].list]?.[id];
  const rows = (Array.isArray(stored) ? stored : []).filter(row =>
   row?.date === data.expectedDate && Array.isArray(row.indexes) && (scope === 'all' || row.indexes.length > 0) &&
   row.indexes.every(index => Object.hasOwn(RECOMMENDATION_INDEXES, index)) &&
   Array.isArray(row.conditions) && row.conditions.length && row.total === row.conditions.length &&
   row.passed === row.conditions.filter(condition => condition.passed === true).length
  ).sort(compareScores).slice(0, RECOMMENDATION_LIMIT);
  renderRows(id, rows, state.strategyPanel.querySelector('.recommend-items'));
  renderRows(id, rows, state.holdingPanel.querySelector('.recommend-items'), false, codeField);
  const adjustment = id === 'breakout' && rows.some(row => row.adjustment !== BREAKOUT_ADJUSTMENT)
   ? ' · 이전 분할 반영 기준' : '';
  setStatus(rows.length
   ? `${data.expectedDate} 저장 종가 · ${rows.length}개 · 시총·재무 기준 통과${adjustment}${data.staleWarning ? ' · 오래된 결과 주의' : ''}`
   : `${data.expectedDate} 기준 추천 후보가 없습니다.`);
 } catch (error) {
  if (requestVersion === state.version) setStatus(error.message);
 }
}
function createRecommendationPanel(id, inHoldings = false) {
 const panel = el('section');
 panel.className = 'panel recommend-panel';
 const listId = (inHoldings ? 'holding-recommend-items-' : 'recommend-items-') + id;
 const title = (inHoldings ? strategyTitles[id] + ' · ' : '') + '추천 상위 ' + RECOMMENDATION_LIMIT + '개';
 panel.innerHTML = `<h2>${title}</h2><p class="recommend-status note" role="status">최근 검색 결과를 확인합니다.</p><div id="${listId}" class="recommend-items top-results"></div>`;
 scopePicker(id,panel,listId);
 const scoreLabel = el('p', scoreName(id) + ' · 충족 조건이 많은 순');
 scoreLabel.className = 'recommend-order note';
 panel.querySelector('.recommend-items').before(scoreLabel);
 if (!inHoldings) {
  const refresh = el('button','추천 불러오기');
  refresh.type = 'button';
  refresh.className = 'recommend-refresh secondary';
  refresh.onclick = () => refreshRecommendations(id,true);
  panel.append(refresh);
 }
 return panel;
}

function scanPanel(id) {
 const panel=el('details');
 panel.className='panel extra';
 const summary=el('summary');
 summary.append(el('h2','자동 검색 결과'));
 const about=el('p',id==='rsi2'?'저장된 RSI2 매수 신호를 스코어가 높은 순으로 표시합니다.':'이 전략의 저장된 자동 검색 후보를 스코어가 높은 순으로 표시합니다.');
 const controls=el('div');
 controls.className='scan-controls';
 const codeInput=el('input');
 codeInput.type='password';codeInput.autocomplete='off';codeInput.placeholder='개인 등록 코드';
 codeInput.setAttribute('aria-label','자동 검색 개인 등록 코드');
 const load=el('button','검색 결과 불러오기'), prev=el('button','이전'), next=el('button','다음');
 for (const button of [load,prev,next]) button.type='button';
 prev.hidden=next.hidden=true;
 const status=el('p','저장된 최근 검색 결과를 불러옵니다.');
 status.className='note';status.setAttribute('role','status');
 const list=el('div');
 list.className='top-results scan-list';
 controls.append(codeInput,load,prev,next);
 panel.append(summary,about,controls,status,list);
 let page=0;
 async function readPage(requested) {
  const code=codeInput.value.trim()||codeFor(id);
  if (!code) {status.textContent='개인 등록 코드를 입력하세요.';codeInput.focus();return}
  load.disabled=prev.disabled=next.disabled=true;
  status.textContent='저장된 검색 결과를 읽는 중입니다…';
  try {
   const url=new URLSearchParams({strategy:id,page:String(requested)});
   const response=await fetch('/api/results?'+url,{headers:{Authorization:'Bearer '+code},cache:'no-store'});
   const result=await response.json();
   if (!response.ok) {
    if (response.status===401) {
     try{localStorage.removeItem(codeKey)}catch{}
     codeInput.hidden=false;
    }
    throw Error(result.error||'검색 결과를 불러오지 못했습니다.');
   }
   try{localStorage.setItem(codeKey,code)}catch{}
   codeInput.value='';codeInput.hidden=true;page=result.page;
   list.replaceChildren();
   for (const row of result.rows) {
    const item=el('button');
    item.type='button';item.className='recommend-open';
    const graphic=renderScoreGraphic(row,{compact:true});
    graphic.prepend(el('small','스코어'));
    item.append(el('strong',row.symbol),graphic);
    item.onclick=()=>openDetail(id,row.symbol,row);
    list.append(item);
   }
   status.textContent=result.rows.length
    ? `${result.expectedDate} 확정 일봉 · ${result.total}종목 · ${page+1}/${result.pages} 페이지${result.staleWarning?' · 오래된 결과 주의':''}`
    : `${result.expectedDate} 확정 일봉 · 검색 결과 없음`;
   prev.hidden=page===0;
   next.hidden=page+1>=result.pages;
  } catch(error){status.textContent=error.message}
  finally{load.disabled=prev.disabled=next.disabled=false}
 }
 codeInput.hidden=Boolean(codeFor(id));
 load.onclick=()=>readPage(0);prev.onclick=()=>readPage(page-1);next.onclick=()=>readPage(page+1);
 return panel;
}
for(const id of ids){const panel=$('strategy-'+id),heading=panel.querySelector('.strategy-head'),recommend=createRecommendationPanel(id),guideRecommend=createRecommendationPanel(id,true),shared=el('section'),backButton=el('button','← 목록으로');shared.className='panel';backButton.className='detail-back secondary';backButton.type='button';backButton.hidden=true;backButton.onclick=()=>back(id);
 recommendationState.set(id, {scope:'major',version:0,strategyPanel:recommend,holdingPanel:guideRecommend});
 holdingRecommendations.append(guideRecommend);
 shared.innerHTML='<h2>관심종목 <span class="watch-count"></span></h2><form class="row watch-form"><input class="watch-code" type="password" autocomplete="off" placeholder="개인 등록 코드" aria-label="개인 등록 코드"><input class="watch-symbol" required pattern="[A-Za-z0-9.\\-]{1,15}" placeholder="티커 입력" aria-label="관심종목 티커"><button>등록</button></form><p class="watch-status note" role="status"></p><div class="watch-items top-results"></div><p class="note">관심종목은 이 브라우저에만 저장되며 모든 탭에서 공유됩니다.</p>';const chartSection=$(cfg[id].chart).closest('section'),imageButton=el('button','차트 이미지 보기');imageButton.type='button';imageButton.className='secondary';imageButton.onclick=()=>{const canvas=$(cfg[id].chart),popup=document.createElement('dialog'),img=document.createElement('img'),close=el('button','닫기');img.src=canvas.toDataURL('image/png');img.alt='선택 종목의 차트 이미지';img.style.cssText='display:block;width:100%;height:auto';popup.className='chart-modal';close.onclick=()=>{popup.close();popup.remove()};popup.append(close,img);document.body.append(popup);popup.showModal()};chartSection.append(imageButton);panel.insertBefore(backButton,heading.nextSibling);panel.insertBefore(recommend,backButton.nextSibling);panel.insertBefore(shared,recommend.nextSibling);panel.insertBefore(scanPanel(id),shared.nextSibling);
 // Preserve previous controls and result containers for existing scripts, but replace their old ranked lists.
 for(const old of [id==='rsi2'?$('topResults'):$(id==='1000'?'thousandList':id+'List')])if(old)old.closest('section').hidden=true;
 const form=shared.querySelector('.watch-form'),field=shared.querySelector('.watch-symbol'),codeInput=shared.querySelector('.watch-code');try{if(localStorage.getItem(codeKey))codeInput.hidden=true}catch{}form.onsubmit=async e=>{e.preventDefault();const symbol=field.value.trim().toUpperCase(),status=shared.querySelector('.watch-status');if(watch.includes(symbol)){status.textContent='이미 등록된 종목입니다.';return}if(watch.length>=10){status.textContent='관심종목은 최대 10개입니다.';return}const code=localStorage.getItem(codeKey)||codeInput.value.trim()||$(cfg[id].code).value.trim();if(!code){status.textContent='개인 등록 코드를 입력하세요.';return}const submit=form.querySelector('button');submit.disabled=true;status.textContent='현재 상장 종목인지 확인하는 중…';try{const response=await fetch('/api/validate-symbol?symbol='+encodeURIComponent(symbol),{headers:{Authorization:'Bearer '+code},cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'종목을 확인하지 못했습니다.');if(watch.includes(symbol)||watch.length>=10)throw Error('이미 등록되었거나 10개 한도에 도달했습니다.');watch.push(symbol);save();localStorage.setItem(codeKey,code);codeInput.hidden=true;field.value='';await refreshWatch(id);refreshRecommendations(id)}catch(e){status.textContent=e.message}finally{submit.disabled=false}};
 $('tab-'+id).addEventListener('click',()=>{back(id);refreshWatch(id);refreshRecommendations(id)});
}
function refreshHoldingRecommendations(reload = false) {
 for (const [index,id] of ids.entries()) refreshRecommendations(id,reload && index === 0);
}
holdingRecommendationsPanel.addEventListener('toggle', () => {
 if (holdingRecommendationsPanel.open) refreshHoldingRecommendations();
});
$('loadHoldingRecommendations').onclick = () => refreshHoldingRecommendations(true);
if (holdingRecommendationsPanel.open) refreshHoldingRecommendations();
refreshWatch(selected());refreshRecommendations(selected());
