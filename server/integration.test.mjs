import {test} from 'node:test';import assert from 'node:assert/strict';import {createECDH} from 'node:crypto';import {scanGrouped} from './grouped-scan.mjs';import {runNotifications} from './run-notifications.mjs';import {createPushSender} from './push-send.mjs';
const dates=Array.from({length:220},(_,i)=>new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10));
const b64=b=>Buffer.from(b).toString('base64url');
test('market snapshots through signal detection and encrypted notification',async()=>{
 const universe={complete:true,securities:[{symbol:'AAA'},{symbol:'BBB'},{symbol:'CCC'}]};
 const scan=await scanGrouped({symbols:universe.securities.map(x=>x.symbol),dates,getDaily:async d=>{let i=dates.indexOf(d),buy=i<215?100+i*.2:143-(i-214)*2;return [{symbol:'AAA',close:buy},{symbol:'BBB',close:100+i},...(i<219?[{symbol:'CCC',close:50+i}]:[])]}});
 assert.equal(scan.buy.length,1);assert.equal(scan.buy[0].symbol,'AAA');assert.equal(scan.waiting[0].symbol,'BBB');assert.equal(scan.stale[0].symbol,'CCC');
 const vapid=createECDH('prime256v1');vapid.generateKeys();const browser=createECDH('prime256v1');browser.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:b64(browser.getPublicKey()),auth:b64(Buffer.alloc(16,7))}};let requests=[],saved;
 const vapidPrivateKey=Buffer.from(vapid.getPrivateKey('hex').padStart(64,'0'),'hex');
 const send=createPushSender({publicKey:b64(vapid.getPublicKey()),privateKey:b64(vapidPrivateKey),subject:'mailto:user@example.com',fetcher:async(url,req)=>{requests.push({url,req});return{ok:true}}});
 const result=await runNotifications({scan,universe,holdings:['BBB'],subscriptions:[subscription],send,saveState:async state=>{saved=state}});
 assert.equal(result.buyCount,1);assert.equal(result.exitCount,1);assert.equal(result.staleCount,1);assert.equal(requests.length,2);assert.equal(saved.buySentDate,dates.at(-1));
 const second=await runNotifications({scan,universe,holdings:['BBB'],previous:saved,subscriptions:[subscription],send,saveState:async()=>{}});assert.equal(second.buyCount,0);assert.equal(second.exitCount,0);assert.equal(requests.length,2);
});
