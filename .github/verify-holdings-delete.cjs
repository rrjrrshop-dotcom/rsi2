const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:412,height:860}});
await page.addInitScript(()=>{if(!localStorage.getItem('initialized')){localStorage.setItem('rsi2_holdings_v1',JSON.stringify([{symbol:'SPY',price:600,qty:1},{symbol:'QQQ',price:400,qty:2}]));localStorage.setItem('initialized','1')}});
await page.goto('http://127.0.0.1:8149/#holdings-settings');
await page.getByRole('checkbox',{name:'SPY 삭제 선택'}).check();
page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'선택 삭제',exact:true}).click();
assert.equal(await page.locator('#holdings>tr').count(),2);
page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'선택 삭제',exact:true}).click();
assert.equal(await page.locator('#holdings>tr').count(),1);
await page.reload();assert.equal(await page.locator('#holdings>tr').count(),1);
await page.getByRole('button',{name:'모두 선택',exact:true}).click();
assert.equal(await page.getByRole('checkbox',{name:'QQQ 삭제 선택'}).isChecked(),true);
page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'전체 삭제',exact:true}).click();
await page.reload();assert.equal(await page.locator('#holdings>tr').count(),0);
assert.equal(await page.getByRole('button',{name:'전체 삭제',exact:true}).isDisabled(),true);
console.log('Verified cancellation, selected deletion, all deletion and reload persistence.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});