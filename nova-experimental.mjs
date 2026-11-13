/** Experimental candidate; 9 observable binary features, not the proprietary score. */
export function experimentalNova(x){
 const names=['HA 종가 > EMA8','HA 종가 > EMA13','HA 종가 > EMA21','HA 종가 > EMA55','EMA8 > EMA13','EMA13 > EMA21','EMA8 > EMA55','MACD > 시그널','스토캐스틱 K > D'];
 const vals=[x.close,x.ema8,x.ema13,x.ema21,x.ema55,x.macd,x.signal,x.k,x.d];
 if(!vals.every(Number.isFinite))return {score:null,checks:[],reason:'지표 데이터 부족'};
 const checks=[x.close>x.ema8,x.close>x.ema13,x.close>x.ema21,x.close>x.ema55,x.ema8>x.ema13,x.ema13>x.ema21,x.ema8>x.ema55,x.macd>x.signal,x.k>x.d];
 const rawScore=checks.filter(Boolean).length;
 // Candidate chosen on the first 20 screenshot examples; its observed range is 1–8.
 // This is a calibrated proxy, not a reconstruction of the proprietary score.
 const score=Math.round(1+7*rawScore/9);
 return {score,rawScore,checks:checks.map((passed,i)=>({name:names[i],passed})),experimental:true};
}
