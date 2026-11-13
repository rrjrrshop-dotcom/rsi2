/** Validate browser subscriptions before passing them to an outbound push client.
 * Push URLs are bearer secrets: do not log subscriptions or store in public repositories.
 */
export function validateSubscription(value){
 if(!value||typeof value!=='object'||!value.keys||typeof value.endpoint!=='string')throw Error('invalid subscription');
 let url;try{url=new URL(value.endpoint)}catch{throw Error('invalid endpoint')}
 const allowed=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='web.push.apple.com'||url.hostname.endsWith('.push.apple.com');
 if(url.protocol!=='https:'||!allowed||url.username||url.password||url.port||url.hash||value.endpoint.length>2048)throw Error('unsupported push endpoint');
 const {p256dh,auth}=value.keys;
 if(typeof p256dh!=='string'||!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh)||typeof auth!=='string'||!/^[A-Za-z0-9_-]{20,30}$/.test(auth))throw Error('invalid subscription keys');
 return {endpoint:value.endpoint,keys:{p256dh,auth}};
}
/** send function is supplied by actual web-push adapter; no claims of delivery on errors. */
export async function dispatchPush({subscriptions,payload,send}){
 if(!Array.isArray(subscriptions)||typeof send!=='function'||!payload||!['buy','exit'].includes(payload.type))throw Error('invalid push request');
 const outcomes=[];
 for(const s of subscriptions){try{const subscription=validateSubscription(s);await send(subscription,JSON.stringify(payload));outcomes.push({status:'delivered'})}catch(err){const expired=err?.statusCode===404||err?.statusCode===410;outcomes.push({status:expired?'expired':'failed'})}}
 return {delivered:outcomes.filter(x=>x.status==='delivered').length,expired:outcomes.filter(x=>x.status==='expired').length,failed:outcomes.filter(x=>x.status==='failed').length,outcomes};
}
