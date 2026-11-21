
const body=document.getElementById('holdings'),panel=document.getElementById('holdings-settings');
const tools=document.createElement('div');tools.className='row';
const selected=new Set();
const count=document.createElement('span');count.setAttribute('role','status');
const make=(text,action)=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=action;tools.append(b);return b};
const all=make('모두 선택',()=>{for(const p of window.stockingHoldings.read())selected.add(p.symbol);render()});
const clear=make('선택 해제',()=>{selected.clear();render()});
const remove=make('선택 삭제',()=>erase(false));
const removeAll=make('전체 삭제',()=>erase(true));
tools.append(count);body.closest('.scroll').before(tools);
function erase(everything){
 const current=window.stockingHoldings.read();
 const targets=everything?current:current.filter(p=>selected.has(p.symbol));
 if(!targets.length)return;
 if(!window.confirm(targets.length+'개 보유종목을 삭제하시겠습니까?'))return;
 try{
 const keys=new Set(targets.map(p=>p.symbol));
 window.stockingHoldings.save(current.filter(p=>!keys.has(p.symbol)));
 selected.clear();render();
 }catch{count.textContent='삭제 내용을 저장하지 못했습니다. 다시 시도하세요.'}
}
function render(){
 const current=window.stockingHoldings.read(),symbols=new Set(current.map(p=>p.symbol));
 for(const symbol of selected)if(!symbols.has(symbol))selected.delete(symbol);
 for(const row of body.rows){
 const cell=row.cells[0];if(!cell)continue;
 const symbol=cell.dataset.symbol;if(!symbol)continue;
 let input=cell.querySelector('[data-holding-delete]');
 if(!input){
 const label=document.createElement('label');label.style.cssText='display:inline-flex;align-items:center;gap:.4rem;margin-right:.5rem';
 input=document.createElement('input');input.type='checkbox';input.dataset.holdingDelete=symbol;
 input.style.cssText='width:1.2rem;min-width:0;height:1.2rem';
 input.setAttribute('aria-label',symbol+' 삭제 선택');
 input.onchange=()=>{if(input.checked)selected.add(symbol);else selected.delete(symbol);render()};
 label.append(input);cell.prepend(label);
 }
 input.checked=selected.has(symbol);
 }
 count.textContent=current.length+'개 중 '+selected.size+'개 선택';
 remove.disabled=clear.disabled=!selected.size;
 removeAll.disabled=!current.length;all.disabled=!current.length||selected.size===current.length;
}
new MutationObserver(render).observe(body,{childList:true});
render();
