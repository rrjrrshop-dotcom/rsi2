import {constantTimeEqual} from '../server/subscriptions.mjs';
import {privateState,validateHoldings} from '../server/private-state.mjs';
import {normalizePhone} from '../server/sms.mjs';

const key='rsi2:alert-preferences';
const mask=phone=>phone?'•••• '+phone.slice(-4):'';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PUT'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 if(!process.env.PAIRING_SECRET||!constantTimeEqual(req.headers.authorization||'',`Bearer ${process.env.PAIRING_SECRET}`))return res.status(401).json({error:'등록 코드가 올바르지 않습니다.'});
 let request;
 if(req.method==='PUT'){
  try{
   const {holdings,watch,phone}=req.body??{};
   if(!Array.isArray(watch)||watch.length>10)throw Error();
   request={holdings:validateHoldings(holdings),watch:validateHoldings(watch)};
   if(phone!==undefined)request.phone=phone===''?'':normalizePhone(phone);
  }catch{return res.status(400).json({error:'종목 목록 또는 전화번호 형식을 확인하세요.'})}
 }
 try{
  const state=privateState({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
  let settings=await state.get(key)??{};
  if(request){settings={...settings,...request};await state.set(key,settings)}
  const ready=process.env.TWILIO_SMS_ENABLED==='true'&&Boolean(settings.phone)&&
   normalizePhone(process.env.TWILIO_VERIFIED_TO)===settings.phone;
  return res.status(200).json({ok:true,holdings:settings.holdings?.length??0,watch:settings.watch?.length??0,phone:mask(settings.phone),smsReady:ready});
 }catch{return res.status(503).json({error:'알림 설정을 읽거나 저장하지 못했습니다.'})}
}
