import {writeFile} from 'node:fs/promises';
import * as groups from './strategy1000-samples.mjs';
import {intradaySamples, intradayRecent} from './intraday-samples.mjs';
import {estimate1000Score} from '../strategy1000-score.mjs';

const rows = Object.values(groups).flat();
const clamp = value => Math.max(0, Math.min(9, Math.round(value)));
const flags = x => ({p8:+(x.close>x.ema8),p13:+(x.close>x.ema13),p21:+(x.close>x.ema21),p55:+(x.close>x.ema55),
  a:+(x.ema8>x.ema13),b:+(x.ema13>x.ema21),c:+(x.ema8>x.ema55),m:+(x.macd>x.signal),s:+(x.k>x.d)});
const candidates = {
  '9조건 단순 합산': x => Object.values(flags(x)).reduce((a,b)=>a+b,0),
  '기존 압축식': x => clamp(1+7*candidates['9조건 단순 합산'](x)/9),
  '모멘텀 가중식': x => {const q=flags(x);return clamp(1+q.p8+q.p13+q.p21+q.p55+q.c+q.m+2*q.s)},
  '균형식': x => {const q=flags(x);return clamp(2+q.p8+q.p21+q.p55+q.a+q.b+q.m+q.s)},
  '추세 가중식': x => {const q=flags(x);return clamp(1+q.p8+q.p13+q.p21+q.p55+q.a+q.b+q.m+q.s)},
  'EMA·모멘텀 가중식 v2': x => estimate1000Score(x).score,
};
function stats(samples, predict) {
  const errors=samples.map(x=>Math.abs(predict(x)-x.observed)), sum=errors.reduce((a,b)=>a+b,0);
  return {n:samples.length,exact:errors.filter(e=>e===0).length,mae:sum/samples.length,
    normalized:sum/samples.length/9*100,mape:errors.reduce((sum,e,i)=>sum+e/samples[i].observed,0)/samples.length*100,max:Math.max(...errors)};
}
const daily=Object.entries(candidates).map(([name,predict])=>({name,...stats(rows,predict)}));
const intradayRows=[...intradaySamples,...intradayRecent];
const intradayPredict=x=>[x.e1,x.e2,x.e3].filter(v=>v>x.e5).length+Number(x.e1>x.e2)+Number(x.e2>x.e3)+2*Number(x.macd>x.signal)+2*Number(x.k>x.d);
const intraday=stats(intradayRows,intradayPredict);
const report=[
 '# 1000 스코어 후보식 비교',
 '',
 '현재 전사된 사용자 이미지 중 일봉 30건과 15분봉 9건을 비교했다. 같은 값을 반복 촬영한 이미지는 추가 표본으로 세지 않았다. 원본 이미지 전체를 빠짐없이 검증했다는 의미는 아니다.',
 '',
 '**v2는 이 표본들을 보며 만든 후보식이다. 아래 수치는 표본 재현 오차이며 독립 검증이나 향후 수익률이 아니다.** 이미지에 인쇄된 반올림 지표를 입력했으므로 실제 OHLC에서 EMA·MACD·스토캐스틱을 산출하는 과정의 오차는 측정하지 않았다.',
 '',
 '## 일봉 6개 후보식',
 '',
 '| 후보 | 일치 | 평균 절대오차 | 9점 만점 기준 오차율 | 원점수 대비 MAPE | 최대 오차 |',
 '|---|---:|---:|---:|---:|---:|',
 ...daily.map(s=>`| ${s.name} | ${s.exact}/${s.n} | ${s.mae.toFixed(3)}점 | ${s.normalized.toFixed(2)}% | ${s.mape.toFixed(2)}% | ${s.max}점 |`),
 '',
 '평균 절대오차는 평균(|계산점수−이미지점수|), 9점 만점 기준 오차율은 평균 절대오차÷9×100, MAPE는 평균(|계산점수−이미지점수|÷이미지점수)×100이다. 비교 표본의 원점수는 모두 0보다 크다.',
 '',
 '## 채택한 일봉 추정식',
 '',
 '참인 조건은 1, 거짓은 0으로 둔다. N은 EMA8·13·21 중 EMA55 위에 있는 선의 개수다.',
 '',
 '`점수 = max(1,N) + I(EMA8>EMA13) + I(EMA13>EMA21) + 2I(MACD>시그널) + 2I(K>D)`',
 '',
 '범위는 1~9점이며 지표가 빠지면 계산 불가로 반환한다. 일봉 30건 중 29건(96.67%)이 일치한다. 남은 불일치는 PLTR의 원점수 4점에 대한 계산값 3점이다. 종목 이름에 따른 예외 보정은 적용하지 않았다. 상세 조회의 가중 추정 스코어와 일봉 조건 충족 수가 같은 1000 추천 후보의 보조 정렬에 사용한다.',
 '',
 '## 일봉별 대조',
 '',
 '| 종목 | 이미지 점수 | 기존 압축식 | v2 | v2−이미지 | 이미지 파일 |',
 '|---|---:|---:|---:|---:|---|',
 ...rows.map(x=>`| ${x.symbol} | ${x.observed} | ${candidates['기존 압축식'](x)} | ${estimate1000Score(x).score} | ${estimate1000Score(x).score-x.observed} | ${x.source} |`),
 '',
 '## 15분봉 연구 후보',
 '',
 '`점수 = EMA1·2·3 중 EMA5 위인 개수 + I(EMA1>EMA2) + I(EMA2>EMA3) + 2I(MACD>시그널) + 2I(K>D)`',
 '',
 `9건 중 ${intraday.exact}건 일치, 평균 절대오차 ${intraday.mae.toFixed(3)}점. 이 표본으로 구성한 식이며 독립 검증이 아니다. 일봉식의 최소 1점 규칙을 15분봉에 임의로 추가하지 않았다. 현재 앱은 15분봉 EMA 구도를 일봉에 연결해 비교하며, 이 15분봉 점수식은 연구 결과로만 보관한다.`,
 '',
 '| 종목 | 이미지 점수 | 계산값 | 차이 | 이미지 파일 |',
 '|---|---:|---:|---:|---|',
 ...intradayRows.map(x=>`| ${x.name} | ${x.observed} | ${intradayPredict(x)} | ${intradayPredict(x)-x.observed} | ${x.source} |`),
 '',
 '## 다른 탭',
 '',
 '| 탭 | 실제 대조한 항목 | 표본과 오차 |',
 '|---|---|---|',
 '| trend | 화면에 나온 이동평균·고저가에 대한 7개 조건 | 8개 예시, 조건 56/56 일치 |',
 '| box | 기준선 대비 거리 `(현재가÷기준선−1)×100` | 2종목·4개 거리, 소수 1자리에서 차이 0.0%p |',
 '| RSI2 | 매수 대기 여부 및 청산 참고 조건 | 2개 예시에서 두 판정 모두 일치 |',
 '| breakout | 1유닛 수량 및 `진입가−2×ATR` 손절가 | 3개 수량 일치, 손절가 최대 차이 0.01달러(0.0048%) |',
 '',
 'breakout 수량 대조에는 이미지 예시의 자본 100,000 및 위험 2%를 사용했다. 앱의 기본 위험 설정은 1%다. trend의 상대강도는 이미지에 나온 판정을 읽어 합계만 대조했으며 독립 계산한 것이 아니다. box 박스 자체의 생성식과 실제 OHLC에서 계산한 지표의 정확도를 위 일치율로 검증했다고 볼 수 없다.',
 '',
 'trend의 상대강도, box의 원본 단계·점수, breakout 및 RSI2의 원본 종합 점수에는 원점수와 모든 입력을 함께 읽을 수 있는 검증 표본이 더 필요하다. 현재 앱에 공개한 참고 점수의 산술 동작은 테스트했지만 원본 점수와의 오차율은 산출하지 않았다. 검증 불가를 오차 0%로 표현하지 않는다.',
 '',
 '재현 명령: `node research/compare-weighted-score.mjs`',
 '다른 탭 대조: `node research/screenshot-audit.mjs` 및 `node research/box-screenshot-audit.mjs`',
 '',
];
await writeFile(new URL('./score-comparison.md',import.meta.url),report.join('\n'));
console.log(JSON.stringify({daily,intraday},null,2));
