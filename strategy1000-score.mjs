/** Screenshot-calibrated proxy. All 30 daily examples informed selection; this is not the original formula. */
export function estimate1000Score(x){
 const checks = [
  ['EMA8 > EMA55', x.ema8, x.ema55, 1],
  ['EMA13 > EMA55', x.ema13, x.ema55, 1],
  ['EMA21 > EMA55', x.ema21, x.ema55, 1],
  ['EMA8 > EMA13', x.ema8, x.ema13, 1],
  ['EMA13 > EMA21', x.ema13, x.ema21, 1],
  ['MACD > 시그널', x.macd, x.signal, 2],
  ['스토캐스틱 %K > %D', x.k, x.d, 2],
 ].map(([name, left, right, weight]) => ({name, left, right, weight,
  passed: [left, right].every(Number.isFinite) ? left > right : null}));
 if (checks.some(check => check.passed === null)) return {score: null, checks, reason: '지표 데이터 부족'};
 const rawScore=checks.reduce((sum,check)=>sum+Number(check.passed)*check.weight,0);
 const baseline=checks.slice(0,3).filter(check=>check.passed).length;
 const score=rawScore+Number(baseline===0);
 return {score,rawScore,checks,experimental:true,method:'weighted-ema-momentum-v2'};
}
