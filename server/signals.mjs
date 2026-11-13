/** Apply the reference rules to already calculated indicators. */
export function classifyRsi2({close,rsi,sma5,sma200}) {
 return {status:close>sma200&&rsi<5?'buy':'wait',exit:close>sma5};
}
/** Confirmed end-of-day long-only RSI(2) mean-reversion rules. */
export function analyze(bars) {
 if(!Array.isArray(bars)) throw new TypeError('bars must be an array');
 const sorted=bars.map(x=>({...x})).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<sorted.length;i++){
  const b=sorted[i];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(b.close)||b.close<=0)throw new Error('Invalid bar');
  if(i&&sorted[i-1].date===b.date)throw new Error('Duplicate date');
 }
 if(sorted.length<200)return {status:'insufficient',count:sorted.length,date:sorted.at(-1)?.date??null};
 const c=sorted.map(b=>b.close);let gain=0,loss=0;
 for(let i=1;i<c.length;i++){
  const d=c[i]-c[i-1],up=Math.max(d,0),down=Math.max(-d,0);
  if(i<=2){gain+=up/2;loss+=down/2}else{gain=(gain+up)/2;loss=(loss+down)/2}
 }
 const rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 const mean=n=>c.slice(-n).reduce((a,b)=>a+b,0)/n;
 const sma5=mean(5),sma200=mean(200),close=c.at(-1);
 return {...classifyRsi2({close,rsi,sma5,sma200}),date:sorted.at(-1).date,close,rsi,sma5,sma200};
}
