/* RSI2 has binary conditions, not a score. Lower RSI ranks qualified symbols only. */
window.renderStockingTop = data => {
 const status=document.getElementById('topStatus'),container=document.getElementById('topResults');container.replaceChildren();
 const entries=(Array.isArray(data.buy)?data.buy:[]).filter(x=>Number.isFinite(x.rsi)).slice().sort((a,b)=>a.rsi-b.rsi||a.symbol.localeCompare(b.symbol)).slice(0,10);
 status.textContent=`${data.expectedDate} 기준 · 매수 신호 ${data.buy.length}개${data.staleWarning?' · 오래된 결과 주의':' · 최신 거래일 확인 필요'}`;
 if(!entries.length){status.textContent+=' · 조건 충족 종목 없음';return}
 for(const item of entries){const button=document.createElement('button'),symbol=document.createElement('strong'),rsi=document.createElement('span');button.type='button';symbol.textContent=item.symbol;rsi.textContent=`RSI ${item.rsi.toFixed(1)}`;button.append(symbol,rsi);button.addEventListener('click',()=>{document.getElementById('lookupSymbol').value=item.symbol;document.getElementById('symbolForm').requestSubmit()});container.append(button)}
};
window.showStockingTopError = message=>{document.getElementById('topResults').replaceChildren();document.getElementById('topStatus').textContent=message};
document.getElementById('topRefresh').addEventListener('click',()=>{const remembered=(()=>{try{return localStorage.getItem('rsi2_device_code_v1')}catch{return null}})();if(!remembered){document.getElementById('resultCode').value=document.getElementById('lookupCode').value;document.getElementById('topStatus').textContent='개인 등록 코드를 종목 조회 칸에 입력한 뒤 다시 눌러 주세요.'}document.getElementById('loadScan').click()});
document.getElementById('tab-rsi2').addEventListener('click',()=>{try{if(localStorage.getItem('rsi2_device_code_v1'))document.getElementById('loadScan').click()}catch{}});
try{if(localStorage.getItem('rsi2_device_code_v1'))document.getElementById('loadScan').click()}catch{}
