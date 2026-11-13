import {notificationPlan} from './notifications.mjs';import {dispatchPush} from './web-push.mjs';
/** Orchestrate a scan snapshot and notification delivery.
 * saveState is called only after all requested notifications succeed for every active subscription.
 * Delivery retries can still duplicate notifications after a crash or partial delivery.
 */
export async function runNotifications({scan,universe,holdings=[],previous={},subscriptions=[],send,saveState,removeExpired}){
 if(!universe?.complete||!Array.isArray(universe.securities))throw Error('incomplete universe');
 if(!scan?.expectedDate||!Number.isInteger(scan.total)||scan.total!==universe.securities.length)throw Error('scan coverage mismatch');
 if((scan.errors||[]).length)throw Error('scan has errors');
 const stale=scan.stale||[];
 const observed=[...scan.buy,...scan.waiting,...scan.insufficient,...stale].map(x=>x.symbol),expected=universe.securities.map(x=>x.symbol);
 if(new Set(observed).size!==expected.length||expected.some(s=>!observed.includes(s)))throw Error('scan symbols mismatch');
 if(!subscriptions.length)throw Error('no devices registered');
 if(typeof send!=='function'||typeof saveState!=='function')throw Error('notification services not configured');
 const plan=notificationPlan({date:scan.expectedDate,scan,holdings,previous});
 const jobs=[];const coverage=stale.length?` · 최신 종가 없음 ${stale.length}개`:'';
 if(plan.buy.length)jobs.push({type:'buy',title:'RSI 2 매수 신호',body:`${plan.date} 기준 ${plan.buy.length}개 종목${coverage} · 앱에서 확인하세요.`});
 else if(stale.length&&previous.coverageSentDate!==plan.date)jobs.push({type:'buy',title:'RSI 2 검색 주의',body:`${plan.date} 기준 최신 종가 없음 ${stale.length}개 · 결과를 확인하세요.`});
 if(plan.exit.length)jobs.push({type:'exit',title:'RSI 2 청산 조건',body:`${plan.date} 기준 보유 종목 ${plan.exit.length}개 · 앱에서 확인하세요.`});
 let active=[...subscriptions];const delivery=[];
 for(const job of jobs){
  const result=await dispatchPush({subscriptions:active,payload:job,send});delivery.push({type:job.type,...result});
  if(result.failed)throw Error('push delivery incomplete; state was not saved');
  if(result.expired){
   if(typeof removeExpired!=='function')throw Error('expired subscription cleanup unavailable');
   const expired=active.filter((_,i)=>result.outcomes[i].status==='expired');
   for(const subscription of expired)await removeExpired(subscription);
   active=active.filter((_,i)=>result.outcomes[i].status!=='expired');
  }
  if(!active.length)throw Error('no active devices remain');
  if(result.delivered!==active.length)throw Error('push delivery incomplete; state was not saved');
 }
 if(stale.length&&jobs.some(x=>x.type==='buy'))plan.nextState.coverageSentDate=plan.date;
 await saveState(plan.nextState);
 return {date:plan.date,buyCount:plan.buy.length,exitCount:plan.exit.length,staleCount:stale.length,delivery};
}
