import vm from 'node:vm';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const src=await readFile('app-update.mjs','utf8'),storage=new Map();
let current='2026-11-21T14:59:00Z',calls=0;
class Clock extends Date{constructor(...args){super(...(args.length?args:[current]))}static now(){return new Date(current).getTime()}}
const context={Date:Clock,Intl,document:{visibilityState:'visible',querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{reload(){}},fetch:async()=>{calls++;return{ok:true,json:async()=>({version:'one'})}},setTimeout(){},setInterval(){}};
const run=async()=>{vm.runInNewContext(src,context);await new Promise(r=>setImmediate(r))};
await run();assert.equal(calls,0);
current='2026-11-21T15:01:00Z';await run();assert.equal(calls,1);
await run();assert.equal(calls,1);
current='2026-11-23T01:00:00Z';await run();assert.equal(calls,1);
current='2026-11-28T15:01:00Z';await run();assert.equal(calls,2);
console.log('Verified Korean Sunday boundary and once-per-day persistence.');
