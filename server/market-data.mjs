/** Massive REST client. API key must be provided by the deployer via environment. */
export class DataError extends Error { constructor(message, status=500){super(message);this.status=status} }
export function makeMarketData({key,fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),maxRetries=0,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
 if(!key) throw new DataError('시장 데이터 API 키가 설정되지 않았습니다.',503);
 async function request(path,params={}) {
  let url=new URL(path,'https://api.massive.com');
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  url.searchParams.set('apiKey',key);
  let response;
  for(let attempt=0;attempt<=maxRetries;attempt++){
   try{response=await fetcher(url,{headers:{Accept:'application/json'}})}
   catch{if(attempt===maxRetries)throw new DataError('시장 데이터에 연결할 수 없습니다.',502);await sleep(Math.min(2000*2**attempt,10000));continue}
   if(response.ok)break;
   const retryable=[429,502,503,504].includes(response.status);
   if(!retryable||attempt===maxRetries)throw new DataError(response.status===429?'데이터 요청 한도를 초과했습니다. 나중에 다시 시도하세요.':`시장 데이터 응답 오류 (${response.status})`,response.status);
   const retryHeader=Number(response.headers?.get?.('retry-after'));
   const delay=response.status===429?Math.min(60000,Math.max(1000,Number.isFinite(retryHeader)&&retryHeader>0?retryHeader*1000:60000)):Math.min(2000*2**attempt,10000);
   await sleep(delay);
  }
  if(!response?.ok)throw new DataError('시장 데이터에 연결할 수 없습니다.',502);
  let data;try{data=await response.json()}catch{throw new DataError('시장 데이터 응답을 읽을 수 없습니다.',502)}
  if(data.status==='ERROR')throw new DataError('시장 데이터 제공자가 요청을 처리하지 못했습니다.',502);
  return data;
 }
 return {
  async daily(ticker,from,to) {
   if(!/^[A-Z0-9.\-]{1,15}$/.test(ticker))throw new DataError('종목 기호가 올바르지 않습니다.',400);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new DataError('조회 날짜가 올바르지 않습니다.',400);
   const data=await request(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}`,{adjusted:'true',sort:'asc',limit:5000});
   return (data.results||[]).map(r=>({date:new Date(r.t).toISOString().slice(0,10),open:r.o,high:r.h,low:r.l,close:r.c,volume:r.v}));
  },
  async fifteenMinute(ticker,from,to) {
   if(!/^[A-Z0-9.\-]{1,15}$/.test(ticker))throw new DataError('종목 기호가 올바르지 않습니다.',400);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw new DataError('조회 날짜가 올바르지 않습니다.',400);
   const data=await request(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/15/minute/${from}/${to}`,{adjusted:'true',sort:'asc',limit:5000});
   if(data.next_url)throw new DataError('15분봉 데이터가 일부만 반환되었습니다.',502);
   return (data.results||[]).map(r=>({timestamp:r.t,open:r.o,high:r.h,low:r.l,close:r.c,volume:r.v}));
  },
  async dailyMarket(date) {
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new DataError('조회 날짜가 올바르지 않습니다.',400);
   const data=await request(`/v2/aggs/grouped/locale/us/market/stocks/${date}`,{adjusted:'true'});
   return (data.results||[]).map(r=>({symbol:r.T,open:r.o,high:r.h,low:r.l,close:r.c,volume:r.v}));
  }
 };
}
