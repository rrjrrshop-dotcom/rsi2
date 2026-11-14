// Preliminary 15-minute proxy: hypothesis informed by the screenshots; this is not an independent validation.
// Rounding and EMA1=HA close make close>EMA1 uninformative, so use EMA 1,2,3,5,50 relationships.
import {intradaySamples as rows,intradayRecent as validation} from './intraday-samples.mjs';
let total=0,exact=0;for(const x of rows){const p=[x.e1>x.e2,x.e2>x.e3,x.e1>x.e5,x.e2>x.e5,x.e3>x.e5,x.e1>x.e50,x.e2>x.e50,x.macd>x.signal,x.k>x.d].filter(Boolean).length;const err=p-x.observed;total+=Math.abs(err);exact+=Number(!err);console.log(`${x.name}\t${x.observed}\t${p}\t${err}\t${x.source}`)}console.log(`n=${rows.length} exact=${exact} MAE=${(total/rows.length).toFixed(2)}`);
// Exploratory only; the same five examples informed these formulas.
const formulas={
 baseline:x=>[x.e1>x.e2,x.e2>x.e3,x.e1>x.e5,x.e2>x.e5,x.e3>x.e5,x.e1>x.e50,x.e2>x.e50,x.macd>x.signal,x.k>x.d].filter(Boolean).length,
 compressed:x=>Math.round(1+7*formulas.baseline(x)/9),
 fastTrend:x=>2+[x.e1>x.e2,x.e2>x.e3,x.e1>x.e5,x.macd>x.signal,x.k>x.d].filter(Boolean).length,
 longTrend:x=>1+[x.e1>x.e2,x.e2>x.e3,x.e1>x.e5,x.e2>x.e5,x.e1>x.e50,x.macd>x.signal,x.k>x.d].filter(Boolean).length
};
for(const [name,fn] of Object.entries(formulas)){const errors=rows.map(x=>Math.abs(fn(x)-x.observed));console.log(name,`MAE=${(errors.reduce((a,b)=>a+b,0)/rows.length).toFixed(2)} exact=${errors.filter(x=>!x).length}/${rows.length}`)}

// Candidate constructed after reading these additional cases; not independently validated.
formulas.fastWeighted=x=>2+Number(x.e1>x.e2)+Number(x.e2>x.e3)+Number(x.e1>x.e5)+2*Number(x.macd>x.signal)+2*Number(x.k>x.d);
// New uploads are held separate from candidate selection; AMD upload repeats a prior example.

console.log('NEW INTRADAY EXAMPLES');for(const x of validation)console.log(x.name,'observed='+x.observed,...Object.entries(formulas).map(([name,fn])=>`${name}=${fn(x)}`),x.source);for(const [name,fn] of Object.entries(formulas)){const e=validation.map(x=>Math.abs(fn(x)-x.observed));console.log(name,`MAE=${(e.reduce((a,b)=>a+b,0)/e.length).toFixed(2)} exact=${e.filter(x=>!x).length}/${e.length}`)}
