import {test} from 'node:test';import assert from 'node:assert/strict';import {parseIndexHtml,fetchWikipediaIndex} from './wikipedia-index.mjs';
const dow='<table class="wikitable"><tr><th>Company</th><th>Exchange</th><th>Symbol</th></tr>'+Array.from({length:30},(_,i)=>`<tr><td>Company ${i}</td><td>NYSE</td><td><a>AA${i}</a></td></tr>`).join('')+'</table>';
test('reads correct columns from an index table',()=>{const x=parseIndexHtml(dow,'dow');assert.equal(x.length,30);assert.equal(x[0].symbol,'AA0');assert.equal(x[0].source,'Wikipedia')});
test('fails closed on missing or partial data',()=>{assert.throws(()=>parseIndexHtml('<table><tr><th>Symbol</th></tr></table>','dow'),/uniquely/);assert.throws(()=>parseIndexHtml(dow.replace(/<tr><td>Company 29<\/td>.*?<\/tr>/,''),'dow'),/incomplete/)});
test('fetch propagates unavailable source',async()=>{await assert.rejects(fetchWikipediaIndex('dow',{fetcher:async()=>({ok:false})}),/unavailable/)});
