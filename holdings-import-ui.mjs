import {readHoldingsImage,reconcileHoldings,isSameHolding,duplicateHoldingMessage} from './holdings-import.mjs';

const field = document.getElementById('holdingsImages');
const read = document.getElementById('readHoldingsImages');
const status = document.getElementById('holdingsImportStatus');
const preview = document.getElementById('holdingsPreview');
const engine = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/';
let engineLoad;

function loadEngine() {
 if (!engineLoad) {
  engineLoad = new Promise((resolve,reject) => {
   const script = document.createElement('script');
   script.src = engine+'tesseract.min.js';
   script.onload = () => resolve(window.Tesseract);
   script.onerror = () => {script.remove();reject(Error('이미지 읽기 도구를 불러올 수 없습니다.'))};
   document.head.append(script);
  }).catch(error => {engineLoad=null;throw error});
 }
 return engineLoad;
}

function showRows(results) {
 const table = document.createElement('table');
 const header = table.createTHead().insertRow();
 for (const label of ['선택','화면 인식','티커','수량','매입가(USD)']) {
  const cell = document.createElement('th');
  cell.scope='col';cell.textContent=label;header.append(cell);
 }
 const body = table.createTBody();
 const rows = results.map((row,index) => {
  const line = body.insertRow();
  const input = (name,value,type='text') => {
   const item=document.createElement('input');
   item.type=type;item.value=value??'';
   item.setAttribute('aria-label',`${index+1}행 ${name}`);
   line.insertCell().append(item);
   return item;
  };
  const checked=input('선택','','checkbox');
  line.insertCell().textContent=[row.name,row.source].filter(Boolean).join(' · ');
  const symbol=input('티커',row.symbol), qty=input('수량',row.qty,'number'), price=input('매입가',row.price,'number');
  qty.step=price.step='any';
  return {checked,symbol,qty,price};
 });
 const selection=document.createElement('div');
 selection.className='row';
 const all=document.createElement('button'), none=document.createElement('button');
 const count=document.createElement('span');
 all.type=none.type='button';
 all.className=none.className='secondary';
 all.textContent='모두 선택';
 none.textContent='모두 해제';
 count.className='note';count.setAttribute('role','status');
 selection.append(all,none,count);
 const save=document.createElement('button');
 save.type='button';save.textContent='선택한 종목 저장';
 function updateSelection(){
  const selected=rows.filter(row=>row.checked.checked).length;
  count.textContent=`${rows.length}개 중 ${selected}개 선택`;
  save.disabled=none.disabled=selected===0;
  all.disabled=selected===rows.length;
 }
 function selectAll(checked){
  for(const row of rows)row.checked.checked=checked;
  updateSelection();
 }
 all.onclick=()=>selectAll(true);
 none.onclick=()=>selectAll(false);
 body.addEventListener('change',event=>{
  if(event.target.type==='checkbox')updateSelection();
 });
 updateSelection();
 save.onclick=()=>{
  try {
   const chosen=rows.filter(row=>row.checked.checked).map(({symbol,qty,price})=>({symbol:symbol.value,qty:qty.value,price:price.value}));
   if (!chosen.length) throw Error('저장할 행을 선택하세요.');
   window.stockingHoldings.save(reconcileHoldings(window.stockingHoldings.read(),chosen));
   status.textContent=`${chosen.length}개 종목을 이 기기에 저장했습니다.`;
   preview.replaceChildren();preview.hidden=true;field.value='';
  } catch(error){status.textContent=error.message}
 };
 preview.replaceChildren(selection,table,save);preview.hidden=false;
}

read.onclick=async()=>{
 const files=Array.from(field.files??[]);
 if (!files.length || files.length>5 || files.some(file=>file.size>15*1024*1024 || !/^image\/(png|jpeg|webp)$/.test(file.type))) {
  status.textContent='15MB 이하의 JPG·PNG·WebP 이미지를 한 번에 1~5개 선택하세요.';
  return;
 }
 read.disabled=true;preview.hidden=true;preview.replaceChildren();
 status.textContent='이미지 읽기 도구를 준비하는 중입니다…';
 let worker;
 try {
  const {createWorker}=await loadEngine();
  worker=await createWorker(['eng','kor'],1,{workerPath:engine+'worker.min.js'});
  await worker.setParameters({tessedit_pageseg_mode:'11'});
  const rows=[];
  for (const [index,file] of files.entries()) {
   status.textContent=`${index+1}/${files.length} 이미지에서 종목을 읽는 중입니다…`;
   const img=await createImageBitmap(file);
   const scale=Math.min(img.width<800?2.2:1,3600/Math.max(img.width,img.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
   canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();
   const {data}=await worker.recognize(canvas,{}, {tsv:true});
   rows.push(...readHoldingsImage(data.tsv??'',canvas.width));
  }
  if (!rows.length) throw Error('보유 종목 행을 읽지 못했습니다. 표 전체가 보이는 선명한 이미지 또는 수기 입력을 이용하세요.');
  showRows(rows);
  status.textContent=`${rows.length}개 행을 찾았습니다. 인식된 값을 검토하고 저장할 행만 선택하세요.`;
 }catch(error){status.textContent=error.message}
 finally{read.disabled=false;await worker?.terminate().catch(()=>{})}
};

document.getElementById('holdingForm').onsubmit = event => {
 event.preventDefault();
 const symbol = document.getElementById('ticker').value.trim().toUpperCase();
 const price = Number(document.getElementById('buy').value);
 const qty = Number(document.getElementById('qty').value);
 const status = document.getElementById('holdingSaveStatus');
 status.textContent = '';
 if (!symbol || !Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return;
 const candidate = {symbol,price,qty};
 const current = window.stockingHoldings.read();
 if (current.some(item => isSameHolding(item,candidate))) {
  status.textContent = duplicateHoldingMessage(symbol);
  return;
 }
 try {
  window.stockingHoldings.save([...current.filter(item => item.symbol !== symbol),candidate]);
  event.target.reset();
 } catch {
  status.textContent = '보유 종목을 이 기기에 저장하지 못했습니다.';
 }
};
