/** A coarse, explicitly provisional EMA comparison, not the unknown NOVA score. */
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function eastern(t){const p=Object.fromEntries(clock.formatToParts(new Date(t)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)}}
export function intradayContext(bars,through){
 if(!Array.isArray(bars)||!/^\d{4}-\d{2}-\d{2}$/.test(through||''))throw Error('15분봉 데이터 또는 기준일이 올바르지 않습니다.');
 const input=bars.filter(b=>Number.isFinite(b.timestamp)).map(b=>({...b,et:eastern(b.timestamp)})).filter(b=>b.et.date<=through&&b.et.minute>=570&&b.et.minute<960).sort((a,b)=>a.timestamp-b.timestamp);
 if(input.length<60)throw Error('15분봉 이력이 부족합니다.');
 if(input.at(-1).et.date!==through)throw Error('일봉과 15분봉 기준일이 다릅니다.');
 if(input.at(-1).et.minute!==945)throw Error('정규장 마지막 15분봉을 확인할 수 없습니다.');
 for(let i=0;i<input.length;i++){let b=input[i];if(![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||(i&&input[i-1].timestamp===b.timestamp))throw Error('15분봉 가격 데이터가 올바르지 않습니다.')}
 let haOpen=null;const close=[];for(const b of input){const c=(b.open+b.high+b.low+b.close)/4;haOpen=haOpen===null?(b.open+b.close)/2:(haOpen+close.at(-1))/2;close.push(c)}
 const ema=n=>{let a=close[0],k=2/(n+1);for(let i=1;i<close.length;i++)a=k*close[i]+(1-k)*a;return a};
 const [e1,e2,e3,e5]=[1,2,3,5].map(ema);const above=[e1,e2,e3].filter(v=>v>e5).length;
 return {through,lastTimestamp:input.at(-1).timestamp,above,bias:above===3?'up':above===0?'down':'mixed',barsUsed:input.length,method:'ema_123_vs_5_proxy'};
}
export function compareFrames(daily,intraday){if(!daily||!intraday||daily.date!==intraday.through)return {status:'unavailable',label:'일봉과 15분봉의 기준일을 확인할 수 없습니다.'};const d=daily.trend==='단기선 모두 55일선 위'?'up':daily.trend==='단기선 모두 55일선 아래'?'down':'mixed',s=intraday.bias;return {status:d===s&&d!=='mixed'?d:'mixed',label:d===s&&d==='up'?'일봉·15분봉 추세 참고: 둘 다 상승':d===s&&d==='down'?'일봉·15분봉 추세 참고: 둘 다 하락':'일봉·15분봉 추세 참고: 혼조',daily:d,intraday:s};}
