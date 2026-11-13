// Arithmetic verification using values already printed in screenshot; not validation of box construction.
const rows=[
 {name:'AMZN',price:271.49,sma:255.69,box:258.41,printedSma:6.2,printedBox:5.1,source:'01-1000031520.jpg'},
 {name:'NVDA',price:171.15,sma:210.84,box:210.18,printedSma:-18.8,printedBox:-18.6,source:'01-1000031565.jpg'}
];
for(const x of rows){for(const [key,base,shown] of [['sma',x.sma,x.printedSma],['box',x.box,x.printedBox]]){const raw=100*(x.price/base-1);console.log(`${x.name} ${key}: calculated=${raw.toFixed(1)}% shown=${shown.toFixed(1)}% rounded_delta=${(Number(raw.toFixed(1))-shown).toFixed(1)}pp`);if(Math.abs(raw-shown)>.051)throw Error('Screenshot mismatch')}}
