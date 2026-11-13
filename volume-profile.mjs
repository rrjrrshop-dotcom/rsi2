import {estimateBox} from './box.mjs';
/** Descriptive context, not a strategy signal or original score. */
export function describeVolumeProfile(bars){
 if(!Array.isArray(bars)||!bars.length)return {available:false,text:'거래량 데이터 부족: 매물대 추정 불가'};
 const last=bars.at(-1),range=estimateBox(bars);if(!range||!Number.isFinite(last.close)||last.close<=0)return {available:false,text:'거래량 데이터 부족: 매물대 추정 불가'};
 const position=last.close>range.upper?'집중 구간 위':last.close<range.lower?'집중 구간 아래':'집중 구간 안';
 return {available:true,lower:range.lower,upper:range.upper,position,through:range.through,text:`거래량 분포 추정 ${range.lower.toFixed(2)}–${range.upper.toFixed(2)} · 현재가 ${position} · ${range.lookback}거래일, 당일 제외`};
}
