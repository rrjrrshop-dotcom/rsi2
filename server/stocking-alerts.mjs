import {strategies,captions} from './holding-scores.mjs';
import {RECOMMENDATION_SCOPES,hasCurrentRecommendationScreen} from '../recommendation-policy.mjs';

const name={holding:'보유종목 청산 조건',watch:'관심종목 조건 충족',recommend:'추천종목 신규 진입'};

export function alertPlan({result,rows,holdings,watch,previous={}}) {
 const exits=new Map(Object.entries(previous.exits??{}).filter(([key])=>holdings.has(key.split('|')[0])));
 const watched=new Map(Object.entries(previous.watched??{}).filter(([key])=>watch.has(key.split('|')[0])));
 const recommended=new Set();
 const signals={holding:new Set(),watch:new Set(),recommend:new Set()};
 for(const {symbol,scores} of rows){
  for(const strategy of strategies){
   const score=scores[strategy];
   if(!score)continue;
   if(holdings.has(symbol))for(const condition of score.exitConditions){
    if(typeof condition.passed!=='boolean')continue;
    const key=[symbol,strategy,condition.label].join('|');
    if(condition.passed&&exits.get(key)!==true)signals.holding.add(`${symbol} ${captions[strategy]} ${condition.label}`);
    exits.set(key,condition.passed);
   }
   if(watch.has(symbol)){
    const known=score.conditions.filter(condition=>condition.passed!==null);
    if(!known.length)continue;
    const key=[symbol,strategy].join('|');
    const met=known.every(condition=>condition.passed===true);
    if(met&&watched.get(key)!==true)signals.watch.add(`${symbol} ${captions[strategy]}`);
    watched.set(key,met);
   }
  }
 }
 for(const [scope,{list}] of Object.entries(RECOMMENDATION_SCOPES)){
  if(!hasCurrentRecommendationScreen(result,scope))continue;
  for(const strategy of strategies)for(const row of result.preliminary[list]?.[strategy]??[]){
   if(row.date===result.expectedDate)recommended.add(row.symbol+'|'+strategy);
  }
 }
 const prior=new Set(previous.recommended??[]);
 for(const key of recommended)if(Array.isArray(previous.recommended)&&!prior.has(key)){
  const [symbol,strategy]=key.split('|');
  signals.recommend.add(`${symbol} ${captions[strategy]}`);
 }
 const jobs=Object.entries(signals).flatMap(([type,entries])=>{
  if(!entries.size)return [];
  const detail=[...entries].slice(0,3).join(' · ');
  return [{type,title:name[type],body:`${result.expectedDate} · ${detail}${entries.size>3?` 외 ${entries.size-3}건`:''}`}];
 });
 return {jobs,next:{date:result.expectedDate,exits:Object.fromEntries(exits),watched:Object.fromEntries(watched),recommended:[...recommended]}};
}
