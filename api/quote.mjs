import {makeMarketData,DataError} from '../server/market-data.mjs';
import {constantTimeEqual} from '../server/subscriptions.mjs';
/** Use only completed US Eastern calendar days; provider's free tier delivers prior dates. */
export function priorEasternDay(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>parts.find(x=>x.type===k).value;
 const date=new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
 date.setUTCDate(date.getUTCDate()-1);
 return date.toISOString().slice(0,10);
}
/** Calendar-day warning only; this does not establish exchange-session freshness. */
export function dataAgeDays(through,requestedThrough){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(through||'')||!/^\d{4}-\d{2}-\d{2}$/.test(requestedThrough||''))throw Error('invalid data dates');
 const age=(Date.parse(requestedThrough+'T00:00:00Z')-Date.parse(through+'T00:00:00Z'))/86400000;
 if(!Number.isFinite(age)||age<0)throw Error('invalid data dates');return age;
}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 if(!process.env.PAIRING_SECRET)return res.status(503).json({error:'개인 접근 설정이 필요합니다.'});
 if(!constantTimeEqual(req.headers?.authorization||'',`Bearer ${process.env.PAIRING_SECRET}`))return res.status(401).json({error:'개인 등록 코드가 올바르지 않습니다.'});
 try {
  const symbol=String(req.query.symbol||'').trim().toUpperCase();
  if(!/^[A-Z0-9.\-]{1,15}$/.test(symbol))throw new DataError('올바른 티커를 입력하세요.',400);
  const latest = priorEasternDay();
  const pinned = req.query.through;
  if (pinned !== undefined && (typeof pinned !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(pinned) ||
      !Number.isFinite(Date.parse(pinned)) || new Date(pinned).toISOString().slice(0, 10) !== pinned || pinned > latest)) {
    throw new DataError('확정 종가의 기준일을 확인하세요.', 400);
  }
  const to=pinned ?? latest,d=new Date(`${to}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-550);
  const from=d.toISOString().slice(0,10);
  const bars=await makeMarketData({key:process.env.MASSIVE_API_KEY}).daily(symbol,from,to);
  if(!bars.length)throw new DataError('해당 기간에 확인된 종가가 없습니다.',404);
  const through=bars.at(-1).date;
  if (pinned && through !== pinned) throw new DataError('추천 기준일의 확정 종가가 없습니다.', 404);
  const ageDays=dataAgeDays(through,latest);
  return res.status(200).json({symbol,bars,source:'Massive',through,requestedThrough:to,ageDays,staleWarning:ageDays>7,adjustment:'split-adjusted'});
 }catch(e){return res.status(e instanceof DataError?e.status:500).json({error:e instanceof DataError?e.message:'조회 중 오류가 발생했습니다.'})}
}
