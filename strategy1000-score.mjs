/** Screenshot-calibrated proxy. All 30 daily examples informed selection; this is not the original formula. */
export function estimate1000Score(x){
 const names=['EMA8 > EMA55','EMA13 > EMA55','EMA21 > EMA55','EMA8 > EMA13','EMA13 > EMA21','MACD > 시그널','스토캐스틱 K > D'];
 const vals=[x.ema8,x.ema13,x.ema21,x.ema55,x.macd,x.signal,x.k,x.d];
 if(!vals.every(Number.isFinite))return {score:null,checks:[],reason:'지표 데이터 부족'};
 const checks=[x.ema8>x.ema55,x.ema13>x.ema55,x.ema21>x.ema55,x.ema8>x.ema13,x.ema13>x.ema21,x.macd>x.signal,x.k>x.d];
 const weights=[1,1,1,1,1,2,2];
 const rawScore=checks.reduce((sum,passed,i)=>sum+Number(passed)*weights[i],0);
 const baseline=checks.slice(0,3).filter(Boolean).length;
 const score=rawScore+Number(baseline===0);
 return {score,rawScore,checks:checks.map((passed,i)=>({name:names[i],passed,weight:weights[i]})),experimental:true,method:'weighted-ema-momentum-v2'};
}
