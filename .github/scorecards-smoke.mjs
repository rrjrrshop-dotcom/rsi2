import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root = process.cwd();
const {scoreStrategy} = await import(pathToFileURL(resolve(root,'scores.mjs')));
const {RECOMMENDATION_SCOPE, RECOMMENDATION_SCREEN_VERSION} = await import(pathToFileURL(resolve(root,'recommendation-policy.mjs')));
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const bars = [];
for (let offset = 0; bars.length < 350; offset++) {
  const date = new Date(Date.UTC(2025, 6, 14 + offset));
  if ([0,6].includes(date.getUTCDay())) continue;
  const close = 100 + 0.06 * bars.length;
  bars.push({date:date.toISOString().slice(0,10),open:close-0.2,high:close+0.7,low:close-0.7,close,volume:1000000});
}
const through=bars.at(-1).date;
const tabs=['rsi2','1000','trend','box','breakout'];
const recommendationResults=Object.fromEntries(tabs.map(tab=>[tab,[{...scoreStrategy(tab,bars,'SPY'),symbol:'TEST',indexes:['nasdaq100','sp500'],date:through},
  {...scoreStrategy(tab,bars,'OTHER'),symbol:'OUTSIDE',indexes:['nasdaq'],date:through}]]));
let old = false;
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path.startsWith('/api/')){
   await new Promise(resolve=>setTimeout(resolve,15));
   res.setHeader('Content-Type','application/json');
   if(path==='/api/quote') return res.end(JSON.stringify({bars,through,source:'테스트 일봉',staleWarning:false}));
   if(path==='/api/frame-context') {res.statusCode=404;return res.end(JSON.stringify({error:'15분봉 없음'}));}
   if(path==='/api/results') return res.end(JSON.stringify({expectedDate:through,total:2,buy:[],preliminary:{recommendations:recommendationResults,
      recommendationScreen:{scope:RECOMMENDATION_SCOPE,version:old?1:RECOMMENDATION_SCREEN_VERSION,through,status:'applied'}}}));
   res.statusCode=404; return res.end('{}');
  }
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+'/')){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');
  res.end(await readFile(file));
 } catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:393,height:852},acceptDownloads:true,deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('rsi2_device_code_v1','local-test-code'));
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 for(const tab of tabs){
  await page.locator('#tab-'+tab).click();
  const panel=page.locator('#strategy-'+tab);
  await panel.locator('.recommend-refresh').waitFor();
  const recommendation=panel.locator('.recommend-item');
  await recommendation.waitFor({state:'visible'});
  assert.equal(await recommendation.count(),1);
  assert.equal(await recommendation.locator('.score-segments').evaluate(el=>getComputedStyle(el).display),'flex');
  assert.match(await recommendation.innerText(),/나스닥 100 · S&P 500/);
  const total={'rsi2':2,'1000':7,'trend':8,'box':4,'breakout':2}[tab];
  assert.match(await recommendation.locator('.score-fraction').innerText(),new RegExp('/'+total+'점'));
  await recommendation.locator('summary').click();
  assert.equal(await recommendation.locator('.condition-list').first().locator('li').count(),total);
  if(tab==='trend'){
   assert.equal(await recommendation.locator('.score-fraction').innerText(),'6/8점');
   assert.equal(await recommendation.locator('svg.fail').count(),2);
   await page.screenshot({path:'/tmp/rsi2-score-card-check.png'});
  }
  await recommendation.locator('.recommend-open').click();
  const detail=panel.locator('.score-caption .score-card');
  await detail.waitFor({state:'visible'});
  assert.equal(await detail.locator('.condition-list').first().locator('li').count(),total);
  if(tab==='trend'){
   assert.equal(await detail.locator('.score-fraction').innerText(),'6/8점');
   assert.equal(await detail.locator('svg.fail').count(),1);
   assert.equal(await detail.locator('svg.unknown').count(),1);
   await page.screenshot({path:'/tmp/rsi2-trend-detail.png'});
   const [download]=await Promise.all([page.waitForEvent('download'),panel.locator('#pdf-trend').click()]);
   assert.equal(download.suggestedFilename(),'TEST-trend-'+through+'.pdf');
  }
  if(tab==='rsi2')assert.match(await detail.innerText(),/보유 시 청산 조건/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await panel.locator('.detail-back').click();
  console.log(tab+' recommendation and detail conditions verified');
 }
 old=true;
 await page.locator('#strategy-breakout .recommend-refresh').click();
 await page.locator('#strategy-breakout .recommend-status').filter({hasText:'새 검색 결과'}).waitFor();
 assert.equal(await page.locator('#strategy-breakout .recommend-item').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Old wider-scope results remain hidden. All five tabs fit a 393px viewport. PDF download works.');
} finally {await browser.close();server.close();}
