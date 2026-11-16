import {scoreStrategy} from './scores.mjs';

export const csvInputs = {
 '1000': 'Date, Open, High, Low, Close · 일봉 60개 이상',
 trend: 'Date, Open, High, Low, Close · 일봉 252개 이상',
 box: 'Date, Open, High, Low, Close, Volume · 일봉 150개 이상 및 30주 이상',
 rsi2: 'Date, Close · 일봉 200개 이상',
 breakout: 'Date, Open, High, Low, Close · 일봉 56개 이상',
};

export function csvScores(strategy, [headers,...rows]) {
 if (!headers || !rows.length) throw Error('CSV에 일봉 데이터가 없습니다.');
 const keys=headers.map(cell=>cell.replace(/^\uFEFF/,'').trim().toLowerCase());
 const index=Object.fromEntries(['date','symbol','open','high','low','close','volume'].map(key=>[key,keys.indexOf(key)]));
 const prices=strategy==='rsi2'?['close']:['open','high','low','close'];
 if (['date',...prices].some(key=>index[key]<0)) {
  throw Error('필요한 CSV 열을 확인하세요. '+csvInputs[strategy]);
 }
 const groups=new Map();
 for (const row of rows) {
  const value=key=>row[index[key]]?.trim()??'';
  const symbol=index.symbol===-1?'종목':value('symbol').toUpperCase();
  const date=value('date'), utc=new Date(date+'T00:00:00Z');
  if (!symbol||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(utc.getTime())||utc.toISOString().slice(0,10)!==date)
   throw Error('종목 또는 날짜를 확인하세요. 날짜는 YYYY-MM-DD 형식을 사용하세요.');
  if (!groups.has(symbol)) groups.set(symbol,[]);
  const bar={date};
  for (const key of prices) bar[key]=value(key)?Number(value(key)):NaN;
  if (value('volume')) {
   const volume=Number(value('volume'));
   if(Number.isFinite(volume)&&volume>=0)bar.volume=volume;
  }
  groups.get(symbol).push(bar);
 }
 return [...groups].map(([symbol,bars])=>{
  bars.sort((a,b)=>a.date.localeCompare(b.date));
  const date=bars.at(-1).date;
  try {
   if (bars.some((bar,i)=>i&&bar.date===bars[i-1].date)) throw Error('같은 날짜의 일봉이 중복됩니다.');
   if (bars.some(bar=>prices.some(key=>!Number.isFinite(bar[key])||bar[key]<=0))) throw Error('양수인 가격을 입력하세요.');
   if (strategy!=='rsi2'&&bars.some(b=>b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))) throw Error('시가·고가·저가·종가의 범위를 확인하세요.');
   return {symbol,date,score:scoreStrategy(strategy,bars,symbol)};
  } catch(error) {
   return {symbol,date,error:error.message};
  }
 });
}
