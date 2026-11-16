const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:412,height:860}});
  await page.addInitScript(()=>{
   localStorage.setItem('rsi2_device_code_v1','mock');
   localStorage.setItem('rsi2_holdings_v1',JSON.stringify([{symbol:'SPY',qty:1,price:600}]));
   localStorage.setItem('stocking_watchlist_v1',JSON.stringify(['QQQ']));
  });
  const errors=[],settings=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/holding-scores'){
    const score={passed:1,total:2,conditions:[{passed:true},{passed:false}],exitConditions:[{passed:true}]};
    const scores=Object.fromEntries(['1000','trend','box','rsi2','breakout'].map(id=>[id,score]));
    return route.fulfill({json:{date:'2026-11-13',rows:[{symbol:'SPY',close:610,date:'2026-11-13',scores}]}});
   }
   if(path==='/api/alert-settings'){
    if(route.request().method()==='PUT')settings.push(route.request().postDataJSON());
    return route.fulfill({json:{holdings:1,watch:1,phone:settings.length?'•••• 5678':'',smsReady:false}});
   }
   return route.fulfill({json:{preliminary:{}}});
  });
  await page.goto('http://127.0.0.1:8149/#holdings-settings');
  await page.locator('#holdings .score-fraction').first().waitFor();
  assert.deepEqual(await page.locator('#holdings .holding-scores small').allTextContents(),['1000','trend','box','RSI2','breakout']);
  assert.deepEqual(await page.locator('#holdings .score-fraction').allTextContents(),Array(5).fill('1/2점'));
  await page.goto('http://127.0.0.1:8149/#notification-settings');
  await page.locator('#alertPhone').fill('010-1234-5678');
  await page.locator('#saveAlertPhone').click();
  await page.getByText(/발송 서비스 연결 및 번호 확인 대기/).waitFor();
  await page.locator('#syncHoldings').click();
  await page.waitForFunction(()=>document.querySelector('#alertSettingsStatus').textContent.includes('알림 저장'));
  assert.deepEqual(settings,[{phone:'010-1234-5678'},{holdings:['SPY'],watch:['QQQ']}]);
  assert.deepEqual(errors,[]);
  console.log('Mobile scores render in tab order; phone registration and ready state verified.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
