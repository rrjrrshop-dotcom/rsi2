import {analyze} from './server/signals.mjs';
import {analyze1000} from './strategy1000.mjs';
import {analyzeTrend} from './trend.mjs';
import {analyzeBox} from './box.mjs';
import {analyzeBreakout} from './breakout.mjs';
const f=x=>Number.isFinite(x)?x.toFixed(2):'—';
export function explainStrategy(id,bars,symbol,analysis){
 if(id==='rsi2'){const r=analysis??analyze(bars);if(r.status==='insufficient')return '일봉이 부족해 조건을 판단할 수 없습니다.';return `매수 검토: ${r.status==='buy'?'200일선 위 및 RSI(2) 5 미만 충족':'매수 조건 미충족, 대기'} · 보유 시: ${r.exit?'종가가 5일선 위로 청산 조건 충족':'5일선 위 청산 조건 미충족'}. 이 화면은 매수 전용이며 공매도 신호를 제공하지 않습니다.`}
 if(id==='1000'){const r=analysis??analyze1000(bars);return `하이킨아시 종가가 단기 EMA 3개 중 ${r.above}개 위 · ${r.order}. 9점 가중 추정값의 원본 산식은 확인되지 않았습니다.`}
 if(id==='trend'){const r=analysis??analyzeTrend(bars,{symbol});return r.unknown ? '8개 조건 전체 통과 여부는 미확정입니다. 1개월 비교에는 21거래일을 사용합니다.' : 'SPY는 비교 기준과 같아 상대강도 우위 조건이 미충족입니다.'}
 if(id==='box'){const r=analysis??analyzeBox(bars);const ready=r.rising30&&r.close>r.sma30,breakout=r.upper!==null&&r.close>r.upper,volume=r.volumeRatio!==null&&r.volumeRatio>=2;return `30주선 ${r.rising30===null?'방향 확인 불가':r.rising30?'상승':'상승 아님'}, 종가 ${r.close>r.sma30?'위':'아래'} · 박스 상단 ${breakout?'돌파':'미돌파'} · 거래량 2배 ${r.volumeRatio===null?'확인 불가':volume?'이상':'미만'}. ${ready&&breakout&&volume?'관찰 기준 충족: 박스 범위와 손절 기준을 확인하세요.':'조건이 모두 확인될 때까지 대기 참고.'} 1~4단계 전체 판정은 미확정입니다.`}
 if(id==='breakout'){const r=analysis??analyzeBreakout(bars,{includeLines:false});return `${r.state==='both'?'20·55일 고점 돌파':r.state==='s1'?'20일 고점 돌파':r.state==='down'?'20일 저점 이탈':'채널 내부 · 대기'}. 진입 참고 ${f(r.entry)}, 2N 손절 참고 ${f(r.stop)}, 청산 참고 S1 ${f(r.low10)} / S2 ${f(r.low20)}. 손절가는 체결을 보장하지 않습니다.`}
 return '분석할 수 없습니다.';
}
