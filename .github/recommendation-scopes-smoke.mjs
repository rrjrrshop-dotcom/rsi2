import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root = process.cwd();
const {scoreStrategy} = await import(pathToFileURL(resolve(root, 'scores.mjs')));
const {RECOMMENDATION_SCOPES, RECOMMENDATION_SCREEN_VERSION} = await import(pathToFileURL(resolve(root, 'recommendation-policy.mjs')));
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const bars = [];
for (let offset = 0; bars.length < 350; offset++) {
 const date = new Date(Date.UTC(2025, 6, 14 + offset));
 if ([0, 6].includes(date.getUTCDay())) continue;
 const close = 100 + 0.06 * bars.length;
 bars.push({date: date.toISOString().slice(0, 10), open: close - .2, high: close + .7, low: close - .7, close, volume: 1000000});
}
const through = bars.at(-1).date;
const newerBars = [...bars, {date:'2026-11-13', open:125, high:130, low:124, close:128, volume:1000000}];
assert.notEqual(through, newerBars.at(-1).date);
const tabs = {rsi2:2, '1000':7, trend:8, box:4, breakout:2};
const preliminary = {};
for (const [scope, {list, screen, id}] of Object.entries(RECOMMENDATION_SCOPES)) {
 preliminary[screen] = {scope: id, version: RECOMMENDATION_SCREEN_VERSION, through, status: 'applied'};
 preliminary[list] = Object.fromEntries(Object.keys(tabs).map(tab => {
  const score = scoreStrategy(tab, bars, 'SPY');
  const results = Array.from({length:7}, (_, i) => ({...score, symbol: (scope === 'major' ? 'MAIN' : 'ALL') + String(i),
   indexes: scope === 'major' ? ['nasdaq100', 'sp500'] : [], date: through}));
  results.unshift({...score, symbol: 'WRONG', indexes: ['sp500'], date: bars.at(-2).date});
  return [tab, results];
 }));
}
const quotes = [];
let marketMissing = false;
const server = createServer(async (request, response) => {
 try {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
   response.setHeader('Content-Type', 'application/json');
   if (url.pathname === '/api/quote') {
    const pinned = url.searchParams.get('through');
    quotes.push({symbol:url.searchParams.get('symbol'), pinned});
    const output = pinned ? bars : newerBars;
    return response.end(JSON.stringify({bars: output, through: output.at(-1).date, source:'테스트 일봉', staleWarning:false}));
   }
   if (url.pathname === '/api/results') {
    const data = {...preliminary};
    if (marketMissing) delete data[RECOMMENDATION_SCOPES.all.screen];
    return response.end(JSON.stringify({expectedDate:through, total:7, buy:[], preliminary:data}));
   }
   response.statusCode = 404;
   return response.end(JSON.stringify({error:'테스트 데이터 없음'}));
  }
  const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!path.startsWith(root + '/')) { response.statusCode = 404; return response.end(); }
  response.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
  response.end(await readFile(path));
 } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', headless:true, args:['--no-sandbox']});
try {
 const context = await browser.newContext({viewport: {width:393, height:852}, acceptDownloads:true, deviceScaleFactor:1});
 await context.addInitScript(() => localStorage.setItem('rsi2_device_code_v1', 'test-code'));
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('http://127.0.0.1:' + server.address().port + '/', {waitUntil:'domcontentloaded'});
 for (const [tab, denominator] of Object.entries(tabs)) {
  await page.locator('#tab-' + tab).click();
  const panel = page.locator('#strategy-' + tab);
  const major = panel.getByRole('button', {name:'주요상장사', exact:true});
  const all = panel.getByRole('button', {name:'전종목', exact:true});
  const cards = panel.locator('.recommend-item');
  await cards.first().waitFor();
  assert.equal(await major.getAttribute('aria-pressed'), 'true');
  assert.equal(await cards.count(), 6);
  assert.match(await cards.first().innerText(), /MAIN0[\s\S]*나스닥 100 · S&P 500/);
  if (tab === 'breakout') await page.screenshot({path:'/tmp/rsi2-scope-major.png'});
  await all.click();
  await cards.first().getByText('ALL0', {exact:true}).waitFor();
  assert.equal(await major.getAttribute('aria-pressed'), 'false');
  assert.equal(await all.getAttribute('aria-pressed'), 'true');
  assert.equal(await cards.count(), 6);
  assert.ok((await all.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)));
  assert.ok((await major.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)));
  assert.match(await cards.first().locator('.score-fraction').innerText(), new RegExp('/' + denominator + '점'));
  assert.match(await panel.locator('.recommend-order').innerText(), new RegExp(tab + ' score'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await cards.first().locator('summary').click();
  const conditions = cards.first().locator('.condition-list').first();
  assert.equal(await conditions.locator('li').count(), denominator);
  if (tab === 'breakout') {
   assert.equal(await conditions.locator('svg.fail').count(), 2);
   await page.screenshot({path:'/tmp/rsi2-scope-all.png'});
  }
  await cards.first().locator('.recommend-open').click();
  const detail = panel.locator('.score-caption .score-card');
  await detail.waitFor();
  assert.equal(await detail.locator('.score-card-title').innerText(), tab + ' score');
  assert.equal(await detail.locator('.condition-list').first().locator('li').count(), denominator);
  if (tab === 'breakout') {
   assert.equal(quotes.at(-1).pinned, through);
   assert.equal(await detail.locator('.score-fraction').innerText(), '0/2점');
   assert.match(await panel.locator('#breakoutStatus').innerText(), /추천 기준일/);
   const [download] = await Promise.all([page.waitForEvent('download'), panel.locator('#pdf-breakout').click()]);
   assert.equal(download.suggestedFilename(), 'ALL0-breakout-' + through + '.pdf');
   await panel.locator('#breakoutForm button').click();
   await panel.locator('#breakoutHeadline').filter({hasText:newerBars.at(-1).date}).waitFor();
   assert.equal(quotes.at(-1).pinned, null);
   assert.equal(await detail.locator('.score-fraction').innerText(), '2/2점');
  }
  await panel.locator('.detail-back').click();
  console.log(tab + ' score and six rows in both scopes verified');
 }
 await page.locator('#tab-breakout').click();
 marketMissing = true;
 const breakout = page.locator('#strategy-breakout');
 await breakout.locator('.recommend-refresh').click();
 await breakout.locator('.recommend-status').filter({hasText:'전종목 범위의 최신 검색 결과'}).waitFor();
 assert.equal(await breakout.locator('.recommend-item').count(), 0);
 await breakout.getByRole('button', {name:'주요상장사', exact:true}).click();
 await breakout.locator('.recommend-item').first().getByText('MAIN0', {exact:true}).waitFor();
 await page.locator('#tab-help').click();
 for (const tab of Object.keys(tabs)) assert.equal(await page.locator('#strategy-help strong').getByText(tab + ' score', {exact:true}).count(), 1);
 assert.deepEqual(errors, []);
 console.log('Verified independent scope data, missing saved data, dated and manual breakout, PDF, guide, and mobile width.');
} finally { await browser.close(); server.close(); }
