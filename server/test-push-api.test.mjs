import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH} from 'node:crypto';
import handler from '../api/subscribe.mjs';

test('test push targets only the authenticated browser with a matching stored subscription', async t => {
 const vapid = createECDH('prime256v1');
 const privateKey = Buffer.alloc(32, 1);
 vapid.setPrivateKey(privateKey);
 const browser = createECDH('prime256v1');
 browser.generateKeys();
 const device = {endpoint:'https://fcm.googleapis.com/fcm/send/test',
  keys:{p256dh:browser.getPublicKey().toString('base64url'),auth:Buffer.alloc(16, 7).toString('base64url')}};
 const config = {
  PAIRING_SECRET:'pair-test', UPSTASH_REDIS_REST_URL:'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN:'storage-test',
  VAPID_PUBLIC_KEY:vapid.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY:privateKey.toString('base64url'),
  VAPID_SUBJECT:'mailto:test@example.com',
 };
 const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
 Object.assign(process.env, config);
 t.after(() => {
  for (const [key, value] of Object.entries(previous)) {
   if (value === undefined) delete process.env[key];
   else process.env[key] = value;
  }
 });
 const sends = [];
 let lookups = 0;
 let pushStatus = 201;
 t.mock.method(globalThis, 'fetch', async (url, options) => {
  if (url === 'https://test.upstash.io') {
   assert.deepEqual(JSON.parse(options.body).slice(0,2), ['HGET','rsi2:subscriptions']);
   lookups++;
   return Response.json({result:JSON.stringify(device)});
  }
  sends.push(url);
  assert.match(options.headers.Authorization, /^vapid t=/);
  assert.equal(options.headers['Content-Encoding'], 'aes128gcm');
  return new Response(null,{status:pushStatus});
 });
 async function request(body, authorization = 'Bearer pair-test') {
  const res = {setHeader(){},status(code){this.code=code;return this},json(payload){return {status:this.code,payload}}};
  return handler({method:'PATCH',headers:{authorization},body},res);
 }
 assert.equal((await request(device, 'Bearer wrong')).status, 401);
 assert.equal(lookups, 0);
 const changedKeys = {...device,keys:{...device.keys,auth:Buffer.alloc(16, 8).toString('base64url')}};
 assert.equal((await request(changedKeys)).status, 404);
 assert.deepEqual(sends, []);
 assert.deepEqual(await request(device), {status:200,payload:{ok:true}});
 assert.deepEqual(sends, [device.endpoint]);
 pushStatus = 410;
 assert.equal((await request(device)).status, 410);
});
