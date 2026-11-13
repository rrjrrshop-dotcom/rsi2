// Preliminary 15-minute proxy: hypothesis informed by the screenshots; this is not an independent validation.
// Rounding and EMA1=HA close make close>EMA1 uninformative, so use EMA 1,2,3,5,50 relationships.
const rows=[
 {name:'NVDA',e1:174.28,e2:174.47,e3:174.62,e5:174.30,e50:174.72,macd:-.267,signal:-.181,k:14.8,d:16.1,observed:2,source:'01-1000031923.jpg'},
 {name:'AMD',e1:554.18,e2:554.84,e3:555.45,e5:554.48,e50:537.63,macd:-1.126,signal:-.585,k:19,d:27,observed:2,source:'02-1000031939.jpg'},
 {name:'PLTR',e1:172.71,e2:172.77,e3:172.80,e5:172.54,e50:170.70,macd:-.058,signal:-.038,k:28.7,d:29.9,observed:3,source:'04-1000031935.jpg'},
 {name:'JPM',e1:342.08,e2:342.31,e3:342.44,e5:342.10,e50:340.88,macd:-.122,signal:.009,k:46.2,d:60.1,observed:2,source:'02-1000031388.jpg'},
 {name:'EWY',e1:142.44,e2:142.60,e3:142.61,e5:141.99,e50:140.82,macd:.114,signal:.160,k:72.2,d:75.3,observed:3,source:'02-1000031348.jpg'}
];
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
const validation=[
 {name:'NFLX',e1:64.42,e2:64.37,e3:64.33,e5:64.15,e50:63.71,macd:.058,signal:.045,k:86,d:85,observed:9,source:'03-1000031947.jpg'},
 {name:'NBIS',e1:155.18,e2:155.53,e3:155.78,e5:155.14,e50:149.45,macd:-.378,signal:-.228,k:18,d:19.6,observed:3,source:'06-1000031973.jpg'},
 {name:'BE',e1:210,e2:210.45,e3:210.79,e5:210.37,e50:203.82,macd:-.566,signal:-.393,k:13.2,d:14.1,observed:2,source:'02-1000031981.jpg'},
 {name:'MSFT',e1:520.50,e2:520.22,e3:520.13,e5:519.55,e50:527.12,macd:-.040,signal:-.151,k:23.1,d:22.8,observed:9,source:'03-1000031963.jpg'}
];
console.log('NEW INTRADAY EXAMPLES');for(const x of validation)console.log(x.name,'observed='+x.observed,...Object.entries(formulas).map(([name,fn])=>`${name}=${fn(x)}`),x.source);for(const [name,fn] of Object.entries(formulas)){const e=validation.map(x=>Math.abs(fn(x)-x.observed));console.log(name,`MAE=${(e.reduce((a,b)=>a+b,0)/e.length).toFixed(2)} exact=${e.filter(x=>!x).length}/${e.length}`)}
