import {readFile} from 'node:fs/promises';import {privateState} from '../server/private-state.mjs';import {upstashSubscriptions,subscriptionService} from '../server/subscriptions.mjs';import {createPushSender} from '../server/push-send.mjs';import {runNotifications} from '../server/run-notifications.mjs';
async function main(){
 const [scanPath='scan-result.json',universePath='universe.json']=process.argv.slice(2),scan=JSON.parse(await readFile(scanPath,'utf8')),universe=JSON.parse(await readFile(universePath,'utf8'));
 const opts={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN},state=privateState(opts),subs=upstashSubscriptions(opts);
 const [holdings,previous,subscriptions]=await Promise.all([state.get('rsi2:holdings-symbols'),state.get('rsi2:notification-state'),subs.list()]);
 const send=createPushSender({publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY,subject:process.env.VAPID_SUBJECT});
 const result=await runNotifications({scan,universe,holdings:holdings||[],previous:previous||{},subscriptions,send,removeExpired:subscription=>subscriptionService(subs).remove(subscription),saveState:x=>state.set('rsi2:notification-state',x)});
 console.log(`Notifications sent: ${result.buyCount} buy; ${result.exitCount} exit; ${result.staleCount} stale`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
