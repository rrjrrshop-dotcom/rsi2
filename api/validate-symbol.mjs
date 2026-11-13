import {constantTimeEqual} from '../server/subscriptions.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 if(!process.env.PAIRING_SECRET)return res.status(503).json({error:'개인 접근 설정이 필요합니다.'});
 if(!constantTimeEqual(req.headers?.authorization||'',`Bearer ${process.env.PAIRING_SECRET}`))return res.status(401).json({error:'개인 등록 코드가 올바르지 않습니다.'});
 const symbol=String(req.query.symbol||'').trim().toUpperCase();if(!/^[A-Z0-9.\-]{1,15}$/.test(symbol))return res.status(400).json({error:'올바른 티커 형식이 아닙니다.'});
 if(!process.env.MASSIVE_API_KEY)return res.status(503).json({error:'시장 데이터 API 키가 설정되지 않았습니다.'});
 try{const url=new URL(`https://api.massive.com/v3/reference/tickers/${encodeURIComponent(symbol)}`);url.searchParams.set('apiKey',process.env.MASSIVE_API_KEY);const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(response.status===404)return res.status(404).json({error:'등록된 상장 종목을 찾을 수 없습니다.'});if(!response.ok)return res.status(response.status===429?429:502).json({error:'종목 확인 서비스를 사용할 수 없습니다. 잠시 후 다시 시도하세요.'});const data=await response.json(),item=data.results;if(!item||item.ticker!==symbol||item.active!==true||item.market!=='stocks')return res.status(404).json({error:'현재 상장된 미국 주식 또는 ETF를 확인할 수 없습니다.'});return res.status(200).json({symbol,name:item.name||symbol,type:item.type||'미확인'});}catch{return res.status(502).json({error:'종목 확인에 실패했습니다. 잠시 후 다시 시도하세요.'})}
}
