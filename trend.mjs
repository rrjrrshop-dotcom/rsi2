/* Trend reference: eight conditions; weighted RS formula is not specified. */
export function evaluateTrend({close:c,s50,s150,s200,prior200,low,high,symbol}){
 const rs=String(symbol||'').toUpperCase()==='SPY'?false:null;
 return [c>s150&&c>s200,s150>s200,s200>prior200,s50>s150&&s150>s200,c>s50,c>=low*1.3,c>=high*.75,rs];
}
export function analyzeTrend(input,{symbol}={}){
 if(!Array.isArray(input)||input.length<252)throw Error('데이터 부족: 최소 252거래일 필요');
 const bars=input.map(x=>({...x})).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<bars.length;i++){const b=bars[i];if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||(i&&bars[i-1].date===b.date))throw Error('일봉 데이터가 올바르지 않습니다.');}
 const i=bars.length-1,avg=(end,n)=>bars.slice(end-n+1,end+1).reduce((sum,b)=>sum+b.close,0)/n;
 // Approximate one month as 21 trading sessions; reference only compares two points.
 const c=bars[i].close,s50=avg(i,50),s150=avg(i,150),s200=avg(i,200),prior200=avg(i-21,200),window=bars.slice(-252),low=Math.min(...window.map(b=>b.low)),high=Math.max(...window.map(b=>b.high));
 const conditions=evaluateTrend({close:c,s50,s150,s200,prior200,low,high,symbol});
 return {date:bars[i].date,close:c,s50,s150,s200,prior200,low,high,conditions,passed:conditions.filter(x=>x===true).length,unknown:conditions.filter(x=>x===null).length,bars};
}
