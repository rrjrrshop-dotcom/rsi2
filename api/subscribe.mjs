import {constantTimeEqual,subscriptionService,upstashSubscriptions} from '../server/subscriptions.mjs';
import {createPushSender} from '../server/push-send.mjs';

async function sendTest(service, body, res) {
 const device = await service.find(body);
 if (!device) return res.status(404).json({error:'이 기기의 알림을 먼저 등록하세요.'});
 try {
  const send = createPushSender({
   publicKey: process.env.VAPID_PUBLIC_KEY,
   privateKey: process.env.VAPID_PRIVATE_KEY,
   subject: process.env.VAPID_SUBJECT,
   fetcher: (url, options) => fetch(url, {...options, redirect:'error', signal:AbortSignal.timeout(10000)}),
  });
  await send(device, JSON.stringify({type:'test',title:'stocking 테스트 알림',body:'이 기기에서 알림을 정상적으로 받았습니다.'}));
  return res.status(200).json({ok:true});
 } catch (error) {
  if (error.statusCode === 404 || error.statusCode === 410) {
   return res.status(410).json({error:'이 기기의 알림 등록이 만료됐습니다. 등록 해제 후 다시 등록하세요.'});
  }
  return res.status(502).json({error:'푸시 서비스에서 테스트 알림을 접수하지 못했습니다.'});
 }
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){
  if(!process.env.VAPID_PUBLIC_KEY)return res.status(503).json({error:'알림 설정이 필요합니다.'});
  return res.status(200).json({publicKey:process.env.VAPID_PUBLIC_KEY});
 }
 if(!['POST','DELETE','PATCH'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 const auth=req.headers.authorization||'';
 if(!constantTimeEqual(auth,`Bearer ${process.env.PAIRING_SECRET||''}`)||!process.env.PAIRING_SECRET)return res.status(401).json({error:'등록 코드가 올바르지 않습니다.'});
 try{
  const storage=upstashSubscriptions({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
  const service=subscriptionService(storage);
  if(req.method==='PATCH')return await sendTest(service,req.body,res);
  if(req.method==='POST')await service.add(req.body);else await service.remove(req.body);
  return res.status(200).json({ok:true});
 }catch(e){if(/invalid subscription|invalid endpoint|unsupported push endpoint|invalid subscription keys/.test(e.message))return res.status(400).json({error:'알림 등록 정보가 올바르지 않습니다.'});return res.status(503).json({error:'알림 저장소에 연결하지 못했습니다.'})}
}
