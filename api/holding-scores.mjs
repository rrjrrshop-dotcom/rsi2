import {constantTimeEqual} from '../server/subscriptions.mjs';
import {validateHoldings} from '../server/private-state.mjs';
import {marketCache} from '../server/market-cache.mjs';
import {holdingScores} from '../server/holding-scores.mjs';

import {resultStore} from '../server/result-store.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 if(!process.env.PAIRING_SECRET||!constantTimeEqual(req.headers.authorization||'',`Bearer ${process.env.PAIRING_SECRET}`))return res.status(401).json({error:'등록 코드가 올바르지 않습니다.'});
 let symbols;
 try{
  if(!Array.isArray(req.body?.symbols)||req.body.symbols.length>24)throw Error();
  symbols=validateHoldings(req.body.symbols);
 }catch{return res.status(400).json({error:'한 번에 최대 24개 티커를 조회하세요.'})}
 try{
  const store=marketCache(),meta=await store.current();
  if(!meta)return res.status(404).json({error:'저장된 일봉이 없습니다.'});
  const rows=await Promise.all(symbols.map(symbol=>holdingScores(store,meta,symbol)));
  const saved=await resultStore({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN}).load();
  for(const row of rows)row.company=saved?.expectedDate===meta.through?saved.companyProfiles?.[row.symbol]:null;
  return res.status(200).json({rows,date:meta.through});
 }catch{return res.status(503).json({error:'저장된 스코어를 읽을 수 없습니다.'})}
}
