import {analyze} from './server/signals.mjs';
import {analyze1000} from './strategy1000.mjs';
import {analyzeTrend} from './trend.mjs';
import {analyzeBox} from './box.mjs';
import {analyzeBreakout} from './breakout.mjs';
/** Indicative scores; deliberately based only on known, disclosed rules. */
export function scoreStrategy(id,bars,symbol=''){
 if(id==='rsi2'){const r=analyze(bars);if(r.status==='insufficient')throw Error('200일 이상 필요');return {score:Math.round((r.close>r.sma200?50:0)+Math.max(0,50-r.rsi/2)),detail:`200일선 ${r.close>r.sma200?'위':'아래'} · RSI ${r.rsi.toFixed(1)}`}}
 if(id==='1000'){const r=analyze1000(bars);return {score:Math.round(r.above/3*100),detail:`HA 종가가 단기 EMA ${r.above}/3개 위`}}
 if(id==='trend'){const r=analyzeTrend(bars,{symbol});return {score:Math.round(r.passed/7*100),detail:`확인된 조건 ${r.passed}/7개`}}
 if(id==='box'){const r=analyzeBox(bars);if(r.upper===null||r.volumeRatio===null)throw Error('박스 또는 거래량 데이터 부족');return {score:(r.close>r.upper?30:0)+(r.close>r.sma30?30:0)+(r.rising30?20:0)+Math.min(20,Math.round(r.volumeRatio*10)),detail:`박스 ${r.relation} · 30주선 ${r.close>r.sma30?'위':'아래'} · 거래량 ${r.volumeRatio.toFixed(1)}배`}}
 if(id==='breakout'){const r=analyzeBreakout(bars,{includeLines:false});return {score:r.state==='both'?100:r.state==='s1'?80:r.state==='down'?0:Math.max(1,Math.min(79,Math.round(80-(r.high20-r.close)/r.atr*10))),detail:r.state==='both'?'20·55일 돌파':r.state==='s1'?'20일 돌파':r.state==='down'?'20일 저점 이탈':'돌파 대기'}}
 throw Error('전략을 찾을 수 없습니다.');
}
export const scoreDescriptions={rsi2:'200일선 위 50점 + RSI가 낮을수록 최대 50점',1000:'HA 종가가 EMA 8·13·21 위인 비율',trend:'확인된 7개 추세 조건의 충족 비율 (상대강도 제외)',box:'박스 상단 위 30점 + 30주선 위 30점 + 30주선 상승 20점 + 거래량 최대 20점',breakout:'55일 돌파 100점, 20일 돌파 80점, 대기는 돌파선과 ATR 거리'};
