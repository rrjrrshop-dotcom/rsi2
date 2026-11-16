const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:412,height:860}});
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('rsi2_device_code_v1','test');
    localStorage.setItem('rsi2_holdings_v1',JSON.stringify([{symbol:'SPY',qty:1,price:100}]));
  });
  const bars=[...Array(30).fill(100),115,130,122,119,150,145,138,165].map((close,i)=>({close,date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10)}));
  await page.route('**/api/**',route=>{
   const url=new URL(route.request().url());requests.push(url.pathname);
   if(url.pathname==='/api/quote')return route.fulfill({json:{bars,through:bars.at(-1).date}});
   if(url.pathname==='/api/holding-scores')return route.fulfill({json:{rows:[],date:bars.at(-1).date}});
   return route.fulfill({json:{preliminary:{}}});
  });
  await page.goto('http://127.0.0.1:8149/#notification-settings');
  await page.locator('#notification-settings .investment-notice').waitFor();
  for(const id of ['1000','trend','box','rsi2','breakout']){
   await page.locator('#tab-'+id).click();
   const guide=page.locator('#strategy-'+id).getByText('차트 읽는 법',{exact:true});
   await guide.click();
   assert.equal(await guide.locator('xpath=../..').evaluate(x=>x.open),true);
  }
  await page.goto('http://127.0.0.1:8149/#holdings-settings');
  await page.locator('.wave-symbol').click();
  await page.locator('#waveChart').waitFor();
  assert.match(await page.locator('#waveStatus').textContent(),/5파 후보/);
  assert.match(await page.locator('#waveRates').textContent(),/5거래일.*자료 부족.*20거래일.*자료 부족/);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  assert.equal(await page.locator('#holdingWave').evaluate(x=>x.open),false);
  assert.equal(requests.filter(path=>path==='/api/quote').length,1);
  assert.deepEqual(errors,[]);
  console.log('Verified the notice, all five guides and clickable wave chart on mobile.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
