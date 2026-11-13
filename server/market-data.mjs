/** Massive REST client. API key must be provided by the deployer via environment. */
export class DataError extends Error { constructor(message, status=500){super(message);this.status=status} }
const marketOrigin = 'https://api.massive.com';
const splitPath = '/stocks/v1/splits';
export function makeMarketData({key,fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),maxRetries=0,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
 if(!key) throw new DataError('시장 데이터 API 키가 설정되지 않았습니다.',503);
 async function request(path,params={}) {
  let url=new URL(path,marketOrigin);
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
  async dailyMarket(date, {adjusted = true} = {}) {
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new DataError('조회 날짜가 올바르지 않습니다.',400);
   const data=await request(`/v2/aggs/grouped/locale/us/market/stocks/${date}`,{adjusted:String(adjusted)});
   return (data.results||[]).map(r=>({symbol:r.T,open:r.o,high:r.h,low:r.l,close:r.c,volume:r.v}));
  },
  async stockDirectory(date) {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new DataError('조회 날짜가 올바르지 않습니다.', 400);
   const path = '/v3/reference/tickers';
   const directory = [];
   const seenPages = new Set();
   let page = await request(path, {market: 'stocks', type: 'CS', active: true, date, limit: 1000, sort: 'ticker', order: 'asc'});
   while (page) {
    if (!Array.isArray(page.results)) throw new DataError('기업 식별자 목록을 확인할 수 없습니다.', 502);
    for (const row of page.results) {
     if (row.type === 'CS' && row.market === 'stocks' && row.locale === 'us' && row.active !== false &&
         typeof row.ticker === 'string' && /^\d{1,10}$/.test(row.cik ?? '')) {
      directory.push({ticker: row.ticker, cik_str: Number(row.cik)});
     }
    }
    if (!page.next_url) break;
    const next = new URL(page.next_url);
    if (next.origin !== marketOrigin || next.pathname !== path || next.username || next.password || seenPages.has(next.search)) {
     throw new DataError('기업 식별자 목록의 다음 페이지 주소가 올바르지 않습니다.', 502);
    }
    seenPages.add(next.search);
    page = await request(path + next.search);
   }
   return directory;
  },
  async splits(from, through) {
   const events = new Map();
   const seenPages = new Set();
   let page = await request(splitPath, {'execution_date.gt': from, 'execution_date.lte': through, limit: 5000});
   while (page) {
    if (!Array.isArray(page.results)) throw new DataError('주식분할 데이터를 확인할 수 없습니다.', 502);
    for (const {id, ticker, execution_date: date, split_from: from, split_to: to} of page.results) {
     if (!id || typeof ticker !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
         !Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) {
      throw new DataError('주식분할 데이터 형식이 올바르지 않습니다.', 502);
     }
     events.set(id, {ticker, date, from, to});
    }
    if (!page.next_url) break;
    const next = new URL(page.next_url);
    if (next.origin !== marketOrigin || next.pathname !== splitPath || next.username || next.password || seenPages.has(next.search)) {
     throw new DataError('주식분할 데이터의 다음 페이지 주소가 올바르지 않습니다.', 502);
    }
    seenPages.add(next.search);
    page = await request(splitPath + next.search);
   }
   const byTicker = new Map();
   for (const {ticker, ...split} of events.values()) {
    const list = byTicker.get(ticker) ?? [];
    list.push(split);
    byTicker.set(ticker, list);
   }
   for (const list of byTicker.values()) list.sort((a,b) => a.date.localeCompare(b.date));
   return byTicker;
  }
 };
}
