
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import kr from '../api/korea-five.mjs';
import quote from '../api/quote.mjs';
import results from '../api/results.mjs';
import holding from '../api/holding-scores.mjs';
process.env.PAIRING_SECRET='test-local';
async function call(handler,method='GET',query={},body){
 let value,status;
 const response={setHeader(){},status(code){status=code;return this},json(data){value=data}};
 await handler({method,query,body,headers:{authorization:'Bearer test-local'}},response);
 assert.equal(status,200,JSON.stringify(value));return value;
}
const korea=await call(kr);
assert.equal(korea.rows.length,5);
for(const row of korea.rows)assert.equal(Object.keys(row.scores).length,5);
const saved=await call(results);
assert.ok(saved.expectedDate);
const sample=await call(quote,'GET',{symbol:'SPY'});
assert.ok(sample.bars.length>=200);
const hs=await call(holding,'POST',{}, {symbols:['SPY']});
assert.equal(hs.rows.length,1);
const server=createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  let body='';for await(const part of req)body+=part;
  const response={setHeader:(...a)=>res.setHeader(...a),status(code){res.statusCode=code;return this},json(data){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}};
  const handlers={'/api/korea-five':kr,'/api/quote':quote,'/api/results':results,'/api/holding-scores':holding};
  if(handlers[url.pathname])await handlers[url.pathname]({method:req.method,query:Object.fromEntries(url.searchParams),body:body?JSON.parse(body):undefined,headers:req.headers},response);
  else {res.statusCode=404;res.end('{}')}
  return;
 }
 const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
 if(path.includes('..'))throw Error();
 const data=await readFile(path);
 res.setHeader('Content-Type',path.endsWith('.mjs')||path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end('not found')}
});
await new Promise(resolve=>server.listen(8149,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:412,height:860}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('rsi2_device_code_v1','test-local'));
 await page.goto('http://127.0.0.1:8149/');
 for(const id of ['1000','trend','box','rsi2','breakout']){
 await page.locator('#tab-'+id).click();
 await page.locator('#strategy-'+id).getByText('국내 저장본 불러오기',{exact:true}).waitFor();
 await page.waitForFunction(id=>[...document.querySelectorAll('#strategy-'+id+' details')].some(x=>x.textContent.includes('한국 시총 상위')&&x.querySelectorAll('.score-fraction').length===5),id);
 }
 await page.goto('http://127.0.0.1:8149/#holdings-settings');
 const form=page.locator('#holdingForm');
 await form.locator('#ticker').fill('SPY');await form.locator('#buy').fill('600');await form.locator('#qty').fill('1');
 await form.locator('button').filter({hasText:'저장'}).first().click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('rsi2_holdings_v1')).some(x=>x.symbol==='SPY'));
 await page.reload();
 assert.ok((await page.evaluate(()=>JSON.parse(localStorage.getItem('rsi2_holdings_v1')))).some(x=>x.symbol==='SPY'));
 await page.locator('#tab-rsi2').click();
 const watch=page.locator('#strategy-rsi2 .watch-form');
 // Use an existing saved ticker. The registration endpoint is wired to the real stored metadata handler.
 await page.evaluate(()=>{localStorage.setItem('stocking_watchlist_v1',JSON.stringify(['SPY']))});
 await page.reload();
 await page.locator('#tab-rsi2').click();
 await page.locator('#strategy-rsi2 .watch-items').getByText('SPY',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('VERIFIED '+JSON.stringify({koreaDate:korea.through,koreanStocks:5,usDate:saved.expectedDate,holdingPersistence:true,watchReload:true}));
}finally{await browser.close();server.close()}
