const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:412,height:860}});
  const calls=[],faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  await page.route('**/api/**',route=>{calls.push(route.request().url());return route.abort()});
  const csv=['Date,Symbol,Open,High,Low,Close,Volume',...Array.from({length:350},(_,i)=>{
   const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),c=100+i*.2+Math.sin(i);
   return [date,'SPY',c,c+1,c-1,c,200].join(',');
  })].join('\n');
  await page.goto('http://127.0.0.1:8149/');
  for(const [id,total] of Object.entries({'1000':7,trend:8,box:4,rsi2:2,breakout:2})){
   await page.locator('#tab-'+id).click();
   const panel=page.locator('#strategy-'+id+' details').filter({has:page.getByRole('heading',{name:'내 시세 파일로 분석하기(선택)',exact:true})});
   await panel.locator('summary').first().click();
   await panel.locator('input[type=file]').setInputFiles({name:'sample.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
   await panel.getByRole('button',{name:id==='rsi2'?'분석하기':'파일로 스코어 계산',exact:true}).click();
   const badge=panel.locator('.score-fraction').first();
   await badge.waitFor();
   assert.match(await badge.textContent(),new RegExp('/'+total+'점$'));
  }
  assert.deepEqual(calls,[]);
  assert.deepEqual(faults,[]);
  console.log('One CSV generated all five local strategy scorecards without API requests.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
