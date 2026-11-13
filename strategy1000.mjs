/** Daily 1000 strategy using the observable trend rules. */
export function analyze1000(input){
 if(!Array.isArray(input)||input.length<60)throw Error('일봉 데이터가 최소 60개 필요합니다.');
 const bars=input.map(b=>({...b})).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<bars.length;i++){const b=bars[i];if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||i&&bars[i-1].date===b.date)throw Error('가격 데이터가 올바르지 않습니다.');}
 const ha=bars.map(b=>({close:(b.open+b.high+b.low+b.close)/4,open:0,high:b.high,low:b.low,volume:b.volume,date:b.date}));
 for(let i=0;i<ha.length;i++){ha[i].open=i?(ha[i-1].open+ha[i-1].close)/2:(bars[i].open+bars[i].close)/2;ha[i].high=Math.max(bars[i].high,ha[i].open,ha[i].close);ha[i].low=Math.min(bars[i].low,ha[i].open,ha[i].close)}
 const closes=ha.map(b=>b.close);function ema(values,n){const alpha=2/(n+1);let prev=values[0];return values.map((v,i)=>i===0?prev:(prev=alpha*v+(1-alpha)*prev))}
 const e8=ema(closes,8),e13=ema(closes,13),e21=ema(closes,21),e55=ema(closes,55),fast=ema(closes,12),slow=ema(closes,26),macd=fast.map((v,i)=>v-slow[i]),signal=ema(macd,9);
 // 14,3,3 slow stochastic on Heikin-Ashi OHLC, configurable only after source specification is available.
 const raw=ha.map((b,i)=>{if(i<13)return null;const x=ha.slice(i-13,i+1),hi=Math.max(...x.map(y=>y.high)),lo=Math.min(...x.map(y=>y.low));return hi===lo?50:100*(b.close-lo)/(hi-lo)});
 const average=(a,i,n)=>i<n-1||a.slice(i-n+1,i+1).some(v=>v===null)?null:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n;
 const k=raw.map((_,i)=>average(raw,i,3)),d=k.map((_,i)=>average(k,i,3));
 const i=bars.length-1,close=closes[i],levels=[e8[i],e13[i],e21[i]],above=levels.filter(x=>close>x).length,position=[0,30,60,100][above];
 const nextLevel=levels.filter(v=>v>=close).sort((a,b)=>a-b)[0]??null,defense=levels.filter(v=>v<close).sort((a,b)=>b-a)[0]??null;
 const trend=levels.every(v=>v>e55[i])?'단기선 모두 55일선 위':levels.every(v=>v<e55[i])?'단기선 모두 55일선 아래':'단기선과 55일선 혼조';
 const order=e8[i]>e13[i]&&e13[i]>e21[i]?'정배열':e8[i]<e13[i]&&e13[i]<e21[i]?'역배열':'혼조';
 let streak=1;const rising=ha[i].close>=ha[i].open;for(let j=i-1;j>=0&&(ha[j].close>=ha[j].open)===rising;j--)streak++;
 return {date:bars[i].date,close,ema8:e8[i],ema13:e13[i],ema21:e21[i],ema55:e55[i],macd:macd[i],signal:signal[i],k:k[i],d:d[i],trend,order,above,position,nextLevel,defense,rising,streak,holding:close>e55[i]?'55일선 위':'55일선 아래',ha,series:{e8,e13,e21,e55,macd,signal,k,d}};
}
