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
await page.goto('http://127.0.0.1:8149/');await page.locator('#tab-help').click();
await page.locator('#korea-five-summary article').first().waitFor();
assert.equal(await page.locator('#korea-five-summary article').count(),5);
for(const row of await page.locator('#korea-five-summary article').all()){
 assert.equal(await row.locator('.score-fraction').count(),5);
 assert.deepEqual(await row.locator('.holding-scores small').allTextContents(),['1000','trend','box','RSI2','breakout']);
 await row.locator('summary').first().click();
 await row.getByText('조건1',{exact:true}).first().waitFor();
}
await page.locator('#korea-five-summary button').first().click();
await page.waitForTimeout(400);
assert.equal(await page.locator('#korea-five-summary article').count(),5);
assert.deepEqual(errors,[]);console.log('Verified five grouped companies and 25 scores on mobile.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
