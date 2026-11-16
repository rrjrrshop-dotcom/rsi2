const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:412,height:860}});
  await page.addInitScript(()=>localStorage.setItem('rsi2_device_code_v1','mock'));
  const errors=[], strategies=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/results*',route=>{
   const strategy=new URL(route.request().url()).searchParams.get('strategy');
   if(strategy)strategies.push(strategy);
   return route.fulfill({json:strategy?{page:0,pages:1,total:1,expectedDate:'2026-11-13',
    rows:[{symbol:'CRM',passed:1,total:2,conditions:[{passed:true},{passed:false}]}]}:{preliminary:{}}});
  });
  await page.goto('http://127.0.0.1:8149/#notification-settings');
  await page.locator('#notification-settings[open] #testPush').waitFor();
  assert.deepEqual(await page.locator('#strategy-help details summary').allTextContents().then(x=>x.slice(0,2)),['1. 휴대폰 알림 등록','2. 보유 종목']);
  await page.goto('http://127.0.0.1:8149/#holdings-settings');
  const img=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=220;
   const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,220);
   ctx.fillStyle='black';ctx.font='26px sans-serif';
   for(const [text,x,y] of [['Ticker',18,60],['Company',105,60],['Transaction',455,60],['Shares',670,60],['Cost',742,60],
    ['CRM',42,110],['Salesforce',105,110],['Buy',490,110],['28',680,110],['186.26',742,110],
    ['NVDA',42,160],['NVIDIA',105,160],['Buy',490,160],['12',680,160],['217.55',742,160]])ctx.fillText(text,x,y);
   return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#holdingsImages').setInputFiles({name:'fictional-portfolio.png',mimeType:'image/png',buffer:Buffer.from(img,'base64')});
  await page.locator('#readHoldingsImages').click();
  await page.waitForFunction(()=>document.querySelector('#holdingsPreview table')||document.querySelector('#holdingsImportStatus').textContent.includes('못'),null,{timeout:90000});
  const preview=page.locator('#holdingsPreview');
  assert.ok(await preview.locator('table').count(),await page.locator('#holdingsImportStatus').textContent());
  const symbols=await preview.locator('input[aria-label$="티커"]').evaluateAll(inputs=>inputs.map(i=>i.value));
  assert.ok(symbols.includes('CRM'),JSON.stringify(symbols));
  const crm=preview.locator('tbody tr').nth(symbols.indexOf('CRM'));
  assert.equal(await crm.locator('input[aria-label$="수량"]').inputValue(),'28');
  assert.equal(await crm.locator('input[aria-label$="매입가"]').inputValue(),'186.26');
  assert.equal(await page.locator('#holdings tr').count(),0);
  await crm.locator('input[type=checkbox]').check();
  await page.getByRole('button',{name:'선택한 종목 저장'}).click();
  await page.locator('#holdings').getByText('CRM',{exact:true}).waitFor();
  for(const strategy of ['1000','trend','box','rsi2','breakout']){
   await page.locator('#tab-'+strategy).click();
   const panel=page.locator('#strategy-'+strategy+' details').filter({has:page.locator('.scan-controls')});
   await panel.locator('summary').click();
   await panel.getByRole('button',{name:'검색 결과 불러오기'}).click();
   await panel.getByRole('button',{name:/CRM.*스코어.*1\/2점/}).waitFor();
  }
  assert.deepEqual(strategies,['1000','trend','box','rsi2','breakout']);
  assert.deepEqual(errors,[]);
  console.log('Browser verified mobile links, OCR review and local save, and five scored lists.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
