import {createECDH,createPrivateKey,createSign,createCipheriv,hkdfSync,randomBytes} from 'node:crypto';
import {validateSubscription} from './web-push.mjs';
const b64=b=>Buffer.from(b).toString('base64url');
const un64=s=>Buffer.from(s,'base64url');
const info=s=>Buffer.from(s+'\0');
const hk=(ikm,salt,inf,len)=>Buffer.from(hkdfSync('sha256',ikm,salt,inf,len));
/** RFC 8291 aes128gcm encrypted Web Push and RFC 8292 VAPID.
 * Secrets are supplied through runtime environment, never written to the repo.
 */
export function createPushSender({publicKey,privateKey,subject,fetcher=fetch,now=()=>Date.now(),random=randomBytes}){
 const pub=un64(publicKey||''),priv=un64(privateKey||'');
 if(pub.length!==65||pub[0]!==4||priv.length!==32||!/^mailto:[^\s@]+@[^\s@]+$/.test(subject||''))throw Error('invalid VAPID configuration');
 const vapidPrivate=createPrivateKey({key:{kty:'EC',crv:'P-256',x:b64(pub.subarray(1,33)),y:b64(pub.subarray(33)),d:b64(priv)},format:'jwk'});
 return async function send(subscription,payload){
  const sub=validateSubscription(subscription),clientPublic=un64(sub.keys.p256dh),auth=un64(sub.keys.auth);
  if(clientPublic.length!==65||clientPublic[0]!==4||auth.length!==16)throw Error('invalid browser keys');
  const message=Buffer.from(payload,'utf8');if(message.length>3000)throw Error('push payload too large');
  const ephemeral=createECDH('prime256v1');ephemeral.generateKeys();const serverPublic=ephemeral.getPublicKey(),shared=ephemeral.computeSecret(clientPublic),salt=random(16);
  const keyInfo=Buffer.concat([info('WebPush: info'),clientPublic,serverPublic]);
  const ikm=hk(shared,auth,keyInfo,32),cek=hk(ikm,salt,info('Content-Encoding: aes128gcm'),16),nonce=hk(ikm,salt,info('Content-Encoding: nonce'),12);
  const cipher=createCipheriv('aes-128-gcm',cek,nonce),encrypted=Buffer.concat([cipher.update(Buffer.concat([message,Buffer.from([2])])),cipher.final(),cipher.getAuthTag()]);
  const size=Buffer.alloc(4);size.writeUInt32BE(4096);const body=Buffer.concat([salt,size,Buffer.from([serverPublic.length]),serverPublic,encrypted]);
  const origin=new URL(sub.endpoint).origin,head=b64(JSON.stringify({typ:'JWT',alg:'ES256'})),claims=b64(JSON.stringify({aud:origin,exp:Math.floor(now()/1000)+43200,sub:subject})),unsigned=head+'.'+claims;
  const signer=createSign('SHA256');signer.update(unsigned);signer.end();const jwt=unsigned+'.'+b64(signer.sign({key:vapidPrivate,dsaEncoding:'ieee-p1363'}));
  let response;try{response=await fetcher(sub.endpoint,{method:'POST',headers:{'Authorization':`vapid t=${jwt}, k=${b64(pub)}`,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream','TTL':'86400'},body})}catch{throw Error('push network request failed')}
  if(!response.ok){let e=new Error('push service rejected request');e.statusCode=response.status;throw e}
 }
}
