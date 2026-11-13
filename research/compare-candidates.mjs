import {samples,heldout,historical,historical2,newHoldout,laterHoldout,novemberUploads} from './nova-samples.mjs';
const all=[...samples,...heldout,...historical,...historical2];
const clamp=x=>Math.max(0,Math.min(9,Math.round(x)));
const flags=x=>({p8:+(x.close>x.ema8),p13:+(x.close>x.ema13),p21:+(x.close>x.ema21),p55:+(x.close>x.ema55),a:+(x.ema8>x.ema13),b:+(x.ema13>x.ema21),c:+(x.ema8>x.ema55),m:+(x.macd>x.signal),s:+(x.k>x.d)});
const f={
 existing:x=>{let q=flags(x);return Object.values(q).reduce((a,b)=>a+b,0)},
 compressed:x=>clamp(1+7*f.existing(x)/9),
 momentum:x=>{let q=flags(x);return clamp(1+q.p8+q.p13+q.p21+q.p55+q.c+q.m+2*q.s)},
 balanced:x=>{let q=flags(x);return clamp(2+q.p8+q.p21+q.p55+q.a+q.b+q.m+q.s)},
 trend_emphasis:x=>{let q=flags(x);return clamp(1+q.p8+q.p13+q.p21+q.p55+q.a+q.b+q.m+q.s)}
};
const stats=(rows,fn)=>{let n=rows.length,errors=rows.map(x=>Math.abs(fn(x)-x.observed));return {n,mae:errors.reduce((a,b)=>a+b,0)/n,exact:errors.filter(x=>!x).length,within1:errors.filter(x=>x<=1).length,max:Math.max(...errors)}};
for(let [name,fn] of Object.entries(f)){console.log(name,JSON.stringify(stats(all,fn)),'last6',JSON.stringify(stats(historical2,fn)))}
console.log('examples');for(const x of all)console.log(x.symbol,x.observed,...Object.values(f).map(fn=>fn(x)),x.source);

console.log('new holdout (selected candidate fixed beforehand)');for(const [name,fn] of Object.entries(f))console.log(name,JSON.stringify(stats(newHoldout,fn)));for(const x of newHoldout)console.log(x.symbol,x.observed,...Object.values(f).map(fn=>fn(x)),x.source);

console.log('later holdout');for(const [name,fn] of Object.entries(f))console.log(name,JSON.stringify(stats(laterHoldout,fn)));for(const x of laterHoldout)console.log(x.symbol,x.observed,...Object.values(f).map(fn=>fn(x)),x.source);

console.log('november uploads');for(const [name,fn] of Object.entries(f))console.log(name,JSON.stringify(stats(novemberUploads,fn)));for(const x of novemberUploads)console.log(x.symbol,x.observed,...Object.values(f).map(fn=>fn(x)),x.source);
