import {constantTimeEqual} from '../server/subscriptions.mjs';
import {redisRest,redisSettings} from '../server/redis-rest.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 if(!process.env.PAIRING_SECRET||!constantTimeEqual(req.headers.authorization||'', 'Bearer '+process.env.PAIRING_SECRET))return res.status(401).json({error:'개인 등록 코드를 확인하세요.'});
 try{
 const value=await redisRest(redisSettings()).command(['GET','rsi2:korea-five']);
 if(!value)return res.status(404).json({error:'국내 상위 5개 기업의 첫 수집을 기다리고 있습니다.'});
 return res.status(200).json(JSON.parse(value));
 }catch{return res.status(503).json({error:'국내 저장본을 읽지 못했습니다.'})}
}