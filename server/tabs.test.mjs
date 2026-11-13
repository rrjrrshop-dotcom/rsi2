import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('five tabs switch independently without removing RSI2 state',async()=>{
 const names=['1000','trend','box','rsi2','breakout'];
 const panels=Object.fromEntries(names.map(id=>['strategy-'+id,{hidden:id!=='rsi2'}]));
 const tabs=names.map(id=>({dataset:{strategy:id},attrs:{'aria-controls':'strategy-'+id},handlers:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},addEventListener(k,v){this.handlers[k]=v},focus(){this.focused=true}}));
 const document={querySelectorAll:()=>tabs,getElementById:id=>panels[id]};
 vm.runInNewContext(await readFile(new URL('../tabs.js',import.meta.url),'utf8'),{document});
 tabs[0].handlers.click();assert.equal(panels['strategy-1000'].hidden,false);assert.equal(panels['strategy-rsi2'].hidden,true);
 tabs[3].handlers.click();assert.equal(panels['strategy-1000'].hidden,true);assert.equal(panels['strategy-rsi2'].hidden,false);assert.equal(tabs[3].attrs['aria-selected'],'true');
 tabs[3].handlers.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(panels['strategy-breakout'].hidden,false);assert.equal(tabs[4].focused,true);
});
test('RSI2 is the default and all five panels are present',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['1000','trend','box','rsi2','breakout'])assert.match(html,new RegExp(`id="strategy-${id}"`));
 assert.match(html,/id="tab-help"/);
 assert.match(html,/id="strategy-help"/);
 assert.match(html,/id="tab-rsi2"[^>]*aria-selected="true"/);
 assert.match(html,/id="strategy-1000"[^>]*hidden/);
});
