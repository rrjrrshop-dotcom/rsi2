const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:412,height:860}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('rsi2_device_code_v1','mock'));
await page.route('**/api/**',route=>{
 const score={passed:1,total:2,conditions:[{label:'조건1',passed:true},{label:'조건2',passed:false}],exitConditions:[]};
 const rows=Array.from({length:5},(_,i)=>({symbol:'00000'+i,name:'기업'+i,marketCap:100000000000,scores:Object.fromEntries(['1000','trend','box','rsi2','breakout'].map(id=>[id,score]))}));
 return route.fulfill({json:new URL(route.request().url()).pathname==='/api/korea-five'?{rows,through:'2026-11-20',rankedAt:'2026-11-21'}:{preliminary:{}}});
});

await page.goto('http://127.0.0.1:8149/');
await page.evaluate(()=>{
 const body=document.getElementById('holdings');body.replaceChildren();
 for(const symbol of ['NBIS','CRM']){
 const row=document.createElement('tr');
 for(let i=0;i<8;i++){
 const td=document.createElement('td');td.textContent=i? '123.45':symbol;
 if(i===0){
 const strip=document.createElement('span');strip.className='holding-scores';
 for(const id of ['1000','trend','box','RSI2','breakout']){
 const chip=document.createElement('span'),label=document.createElement('small'),score=document.createElement('span');
 label.textContent=id;score.textContent='7/9점 · 77.8점';score.className='score-fraction';
 chip.append(label,score);strip.append(chip);
 }td.append(strip)
 }row.append(td)
 }body.append(row)
 }
});
await page.goto('http://127.0.0.1:8149/#holdings-settings');
for(const width of [360,412,768]){
 await page.setViewportSize({width,height:860});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const strips=page.locator('#holdings .holding-scores');
 for(const strip of await strips.all()){
 assert.equal(await strip.evaluate(el=>new Set([...el.children].map(x=>Math.round(x.getBoundingClientRect().top))).size),1);
 assert.ok(await strip.evaluate(el=>el.clientWidth<=innerWidth));
 }
}
assert.deepEqual(errors,[]);console.log('Verified five grouped companies and 25 scores on mobile.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
