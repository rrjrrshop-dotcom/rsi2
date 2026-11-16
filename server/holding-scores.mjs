import {pricesThrough,dividendsThrough} from './market-cache.mjs';
import {adjustBreakoutBars} from '../breakout.mjs';
import {scoreStrategy} from '../scores.mjs';

export const strategies=['1000','trend','box','rsi2','breakout'];
export const captions={'1000':'1000',trend:'trend',box:'box',rsi2:'RSI2',breakout:'breakout'};

export async function holdingScores(store,meta,symbol) {
 const record=await store.record(meta,symbol);
 if(record?.bars.at(-1)?.date!==meta.through) return {symbol,scores:{}};
 const bars=pricesThrough(record,meta.through);
 const scores={};
 for(const strategy of strategies){
  try{
   const input=strategy==='breakout'?adjustBreakoutBars(bars,dividendsThrough(record,meta.through)):bars;
   scores[strategy]=scoreStrategy(strategy,input,symbol);
  }catch{ /* A strategy can require more history than the saved ticker has. */ }
 }
 return {symbol,date:meta.through,close:bars.at(-1).close,scores};
}
