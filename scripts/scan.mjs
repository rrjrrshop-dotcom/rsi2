import {attachSecurityMetadata} from '../server/scan-metadata.mjs';import {readFile,writeFile} from 'node:fs/promises';import {resultStore} from '../server/result-store.mjs';
import {tradingDatesFromBars} from '../server/trading-calendar.mjs';import {priorEasternDay} from '../api/quote.mjs';
import {makeMarketData} from '../server/market-data.mjs';import {intradayContext,compareFrames} from '../intraday1000.mjs';import {scanGrouped} from '../server/grouped-scan.mjs';import {snapshotStore,withSnapshotCache} from '../server/snapshot-store.mjs';import {rateLimit} from '../server/batch-scan.mjs';
import {daysBefore, loadSecFundamentals, MAX_FUNDAMENTALS_AGE_DAYS} from '../server/sec-fundamentals.mjs';
import {screenRecommendations} from '../server/recommendation-screen.mjs';

async function prepareRecommendations(client, securities, through) {
  const fundamentals = await loadSecFundamentals(securities, through);
  const [closingBars, splits] = await Promise.all([
   client.dailyMarket(through, {adjusted: false}),
   client.splits(daysBefore(through, MAX_FUNDAMENTALS_AGE_DAYS), through),
  ]);
  if (!closingBars.length) throw Error('시가총액 기준일의 종가 데이터가 없습니다.');
  const closes = new Map(closingBars.map(row => [row.symbol, row.close]));
  const screen = screenRecommendations(securities, fundamentals, closes, splits, through);
  if (screen.summary.status !== 'applied') throw Error('시가총액과 재무건전성을 확인할 자료가 부족합니다.');
  console.log('Recommendation screen:', JSON.stringify(screen.summary));
  return screen;
}
async function main(){
 const [universePath,datesPath,outputPath='scan-result.json']=process.argv.slice(2);
 if(!universePath||!datesPath)throw Error('Usage: node scripts/scan.mjs universe.json trading-dates.json [output.json]');
 const universe=JSON.parse(await readFile(universePath,'utf8'));let dates=datesPath==='auto'?null:JSON.parse(await readFile(datesPath,'utf8'));
 if(!universe.complete||!Array.isArray(universe.securities))throw Error('Universe is incomplete: do not report this scan as complete');
 const symbols=universe.securities.map(x=>x.symbol);
 const limitedFetch=rateLimit((url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),{intervalMs:13000});
 const client=makeMarketData({key:process.env.MASSIVE_API_KEY,maxRetries:2,fetcher:limitedFetch});
 const fetchDaily=date=>client.dailyMarket(date);
 if(!dates){const to=priorEasternDay(),d=new Date(`${to}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-550);const reference=await client.daily('SPY',d.toISOString().slice(0,10),to);dates=tradingDatesFromBars(reference,{asOf:to}).slice(-350);}
 // Split-adjusted historical values may change after a corporate action. Reuse
 // snapshots only within the same scan date; do not carry them across sessions.
 const cachePath=`.rsi-cache/${dates.at(-1)}`;
 const getDaily=withSnapshotCache(snapshotStore(cachePath),fetchDaily);
 if (!Array.isArray(dates) || !dates.length) throw Error('확정 거래일이 없습니다.');
 // Verify financial data before spending the free-plan quota on historical prices.
 const screen = await prepareRecommendations(client,universe.securities,dates.at(-1));
 const result=await scanGrouped({symbols,dates,getDaily,recommendationSymbols:screen.eligible,onProgress:p=>console.error(`${p.completed}/${p.total} ${p.date}`)});
 result.preliminary.recommendationScreen=screen.summary;
 console.log('Recommendation counts:',JSON.stringify(Object.fromEntries(Object.entries(result.preliminary.recommendations).map(([tab,rows])=>[tab,rows.length]))));
 // Only the displayed 1000 candidates receive a 15-minute comparison;
 // all other securities retain the daily-only ranking. Failures remain explicit.
 const through=result.expectedDate,fromDate=new Date(through+'T00:00:00Z');fromDate.setUTCDate(fromDate.getUTCDate()-7);
 for(const candidate of result.preliminary.recommendations['1000']){
  try{const frame=intradayContext(await client.fifteenMinute(candidate.symbol,fromDate.toISOString().slice(0,10),through),through),compared=compareFrames(candidate.dailyFrame,frame);candidate.frameComparison={...compared,through,method:frame.method}}
  catch(e){candidate.frameComparison={status:'unavailable',label:'15분봉 비교 불가',through};console.error(`${candidate.symbol}: 15분봉 확인 실패 (${e.message})`)}
  delete candidate.dailyFrame;
 }
 const finalResult={...attachSecurityMetadata(result,universe.securities),createdAt:new Date().toISOString()};const tmp=`${outputPath}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(finalResult,null,2));const {rename}=await import('node:fs/promises');await rename(tmp,outputPath);
 if(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN)await resultStore({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN}).save(finalResult);
 console.log(`Complete: ${result.total} symbols, ${result.buy.length} buy, ${result.stale.length} stale`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
