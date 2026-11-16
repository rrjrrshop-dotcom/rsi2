import {createHash} from 'node:crypto';
import {privateState} from '../server/private-state.mjs';
import {redisSettings} from '../server/redis-rest.mjs';
import {marketCache} from '../server/market-cache.mjs';
import {resultStore} from '../server/result-store.mjs';
import {upstashSubscriptions,subscriptionService} from '../server/subscriptions.mjs';
import {createPushSender} from '../server/push-send.mjs';
import {holdingScores} from '../server/holding-scores.mjs';
import {alertPlan} from '../server/stocking-alerts.mjs';
import {normalizePhone,smsReady,sendSms} from '../server/sms.mjs';
import {collectionTarget} from '../server/trading-calendar.mjs';

async function main(){
 const settings=redisSettings(),state=privateState(settings),store=marketCache(settings);
 const meta=await store.current();
 if(meta?.through!==collectionTarget()){console.log('No confirmed close to notify');return}
 const key='rsi2:alert-deliveries';
 const saved=await state.get(key)??{};
 if(saved.completed?.date===meta.through){console.log('Alerts already checked for '+meta.through);return}
 const [result,prefs,legacy,registeredPhone]=await Promise.all([resultStore(settings).load(),state.get('rsi2:alert-preferences'),
  state.get('rsi2:holdings-symbols'),state.get('rsi2:alert-phone')]);
 if(result?.expectedDate!==meta.through)throw Error('Market close and alert source do not match');
 const subs=upstashSubscriptions(settings);
 const devices=await subs.list();
 const phone=registeredPhone??prefs?.phone;
 const canSms=smsReady()&&phone&&normalizePhone(process.env.TWILIO_VERIFIED_TO)===phone;
 if(!devices.length&&!canSms){console.log('No registered alert destinations');return}
 const holdings=new Set(prefs?.holdings??legacy??[]),watch=new Set(prefs?.watch??[]);
 const names=[...new Set([...holdings,...watch])];
 const rows=[];
 for(let i=0;i<names.length;i+=24){
  rows.push(...await Promise.all(names.slice(i,i+24).map(symbol=>holdingScores(store,meta,symbol))));
 }
 const pending=saved.pending?.date===meta.through?saved.pending:null;
 const plan=pending?.plan??alertPlan({result,rows,holdings,watch,previous:saved.completed});
 const delivered=new Set(pending?.delivered??[]);
 const mark=async id=>{
  delivered.add(id);
  saved.pending={date:meta.through,delivered:[...delivered],plan};
  await state.set(key,saved);
 };
 let errors=0,count=0;
 const send=devices.length?createPushSender({
  publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY,subject:process.env.VAPID_SUBJECT,
 }):null;
 let active=devices;
 for(const job of plan.jobs){
  const expired=new Set();
  for(const device of active){
   const id=job.type+':'+createHash('sha256').update(device.endpoint).digest('hex');
   if(delivered.has(id))continue;
   try{await send(device,JSON.stringify(job))}
   catch(error){
    if(error.statusCode===404||error.statusCode===410){await subscriptionService(subs).remove(device);expired.add(device);continue}
    errors++;continue;
   }
   await mark(id);count++;
  }
  active=active.filter(device=>!expired.has(device));
 }
 if(canSms&&plan.jobs.length&&!delivered.has('sms')){
  let accepted=false;
  const text=plan.jobs.map(job=>job.title+' '+job.body).join('\n');
  try{await sendSms(phone,text);accepted=true}catch{errors++}
  if(accepted){await mark('sms');count++}
 }
 console.log(`Alert categories: ${plan.jobs.map(job=>job.type).join(',')||'none'}; accepted deliveries: ${count}`);
 if(errors)throw Error('Some alerts were not accepted and will be retried');
 await state.set(key,{completed:plan.next});
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
