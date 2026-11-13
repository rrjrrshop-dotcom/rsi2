import {constantTimeEqual,subscriptionService,upstashSubscriptions} from '../server/subscriptions.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){
  if(!process.env.VAPID_PUBLIC_KEY)return res.status(503).json({error:'알림 설정이 필요합니다.'});
  return res.status(200).json({publicKey:process.env.VAPID_PUBLIC_KEY});
 }
 if(req.method!=='POST'&&req.method!=='DELETE')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 const auth=req.headers.authorization||'';
 if(!constantTimeEqual(auth,`Bearer ${process.env.PAIRING_SECRET||''}`)||!process.env.PAIRING_SECRET)return res.status(401).json({error:'등록 코드가 올바르지 않습니다.'});
 try{
  const storage=upstashSubscriptions({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
  const service=subscriptionService(storage);if(req.method==='POST')await service.add(req.body);else await service.remove(req.body);
  return res.status(200).json({ok:true});
 }catch(e){if(/invalid subscription|invalid endpoint|unsupported push endpoint|invalid subscription keys/.test(e.message))return res.status(400).json({error:'알림 등록 정보가 올바르지 않습니다.'});return res.status(503).json({error:'알림 저장소에 연결하지 못했습니다.'})}
}
