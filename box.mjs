/** Estimate a volume-at-price range, not exchange-level volume profile.
 * Distribute each completed daily bar's volume uniformly over its low/high range.
 * Exclude the latest session so a breakout cannot redefine its own boundary.
 */
export function estimateBox(bars,{lookback=60,bins=48}={}){
 const history=bars.slice(-lookback-1,-1);
 if(history.length<30||history.some(b=>![b.low,b.high,b.volume].every(Number.isFinite)||b.low<=0||b.high<b.low||b.volume<0))return null;
 const low=Math.min(...history.map(b=>b.low)),high=Math.max(...history.map(b=>b.high));
 if(high<=low)return null;
 const step=(high-low)/bins,volume=Array(bins).fill(0);
 for(const b of history){let from=Math.max(0,Math.min(bins-1,Math.floor((b.low-low)/step))),to=Math.max(0,Math.min(bins-1,Math.floor((b.high-low)/step)));for(let i=from;i<=to;i++)volume[i]+=b.volume/(to-from+1)}
 const total=volume.reduce((a,b)=>a+b,0);if(!(total>0))return null;
 let cumulative=0,first=null,last=null;for(let i=0;i<bins;i++){cumulative+=volume[i];if(first===null&&cumulative>=total*.15)first=i;if(last===null&&cumulative>=total*.85)last=i}
 if(first===last)return null;
 return {lower:low+first*step,upper:low+(last+1)*step,source:'volume-estimate',lookback:history.length,through:history.at(-1).date};
}
/** Weekly SMA is computed using the most recent daily close of each Mon–Fri week.
 * The current week may be incomplete. Box limits are user supplied, not inferred.
 */
export function analyzeBox(input,{upper=null,lower=null}={}){
 if(!Array.isArray(input)||input.length<150)throw Error('데이터 부족: 일봉 최소 150개 필요');
 const bars=input.map(x=>({...x})).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<bars.length;i++){const b=bars[i];if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||(i&&bars[i-1].date===b.date))throw Error('일봉 데이터가 올바르지 않습니다.')}
 const groups=new Map(),weeklyKey=date=>{const d=new Date(date+'T00:00:00Z'),day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-(day+6)%7);return d.toISOString().slice(0,10)};
 for(const b of bars){const k=weeklyKey(b.date);groups.set(k,{date:b.date,close:b.close})}const weeks=[...groups.values()];if(weeks.length<30)throw Error('데이터 부족: 최소 30개 주봉 필요');
 if((upper!==null&&(!Number.isFinite(upper)||upper<=0))||(lower!==null&&(!Number.isFinite(lower)||lower<=0))||(upper!==null&&lower!==null&&upper<=lower))throw Error('박스 상단은 하단보다 높은 양수여야 합니다.');
 if((upper===null)!==(lower===null))throw Error('박스 상단과 하단은 함께 입력하세요.');
 const estimate=upper===null?estimateBox(bars):null;const boxSource=upper===null?(estimate?'volume-estimate':'unavailable'):'manual';if(estimate){upper=estimate.upper;lower=estimate.lower}
 const latest=bars.at(-1),sma30=weeks.slice(-30).reduce((a,b)=>a+b.close,0)/30,priorSma30=weeks.length>=31?weeks.slice(-31,-1).reduce((a,b)=>a+b.close,0)/30:null,prev=bars.slice(-51,-1),validVolume=prev.length===50&&prev.every(b=>Number.isFinite(b.volume)&&b.volume>=0)&&Number.isFinite(latest.volume)&&latest.volume>=0;const mean=validVolume?prev.reduce((a,b)=>a+b.volume,0)/50:null,volumeRatio=mean>0?latest.volume/mean:null;
 const relation=upper===null||lower===null?'미설정':latest.close>upper?'상단 위':latest.close<lower?'하단 아래':'박스 내부';
 const rising30=priorSma30===null?null:sma30>priorSma30;return {date:latest.date,close:latest.close,sma30,priorSma30,rising30,weekPartial:new Date(latest.date+'T00:00:00Z').getUTCDay()!==5,volumeRatio,upper,lower,relation,boxSource,estimate,bars,weeks};
}
