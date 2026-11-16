import {analyze} from './server/signals.mjs';
import {analyze1000, shortEmasCrossed, SHORT_EMA_LOOKBACK} from './strategy1000.mjs';

export const THOUSAND_SCORE_TOTAL = 9;
import {analyzeTrend} from './trend.mjs';
import {analyzeBox} from './box.mjs';
import {analyzeBreakout} from './breakout.mjs';

const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const comparison = (left, right, digits) => number(left, digits) + ' / ' + number(right, digits);
const percent = value => (value >= 0 ? '+' : '') + number(value, 1) + '%';
const check = (label, passed, value = '') => ({label, passed: passed ?? null, value});
export const scoreName = id => id + ' score';

function assessment(id, conditions, {exitConditions = [], note = '', tieBreaker = 0} = {}) {
  return {heading: scoreName(id), passed: conditions.filter(condition => condition.passed === true).length,
    total: conditions.length, conditions, exitConditions, note, tieBreaker};
}

/** Use the same condition results in detail views, watchlists, recommendations and exports. */
export function scoreAnalysis(id, result) {
  switch (id) {
    case '1000': {
      const {close, ema8, ema13, ema21, ema55, previousClose, previousEma55, rising, above, series, macd, signal, k, d} = result;
      const averages = [ema8, ema13, ema21];
      const emaValues = averages.map(value => number(value)).join(' / ');
      const bullishOrder = ema8 > ema13 && ema13 > ema21;
      const aboveLongAverage = close > ema55;
      const crossed = series ? shortEmasCrossed(series) : null;
      return assessment(id, [
        check('단기 EMA 정배열 · 8 > 13 > 21', bullishOrder, emaValues),
        check('눌림 기준 · HA 종가 > EMA21', close > ema21, comparison(close, ema21)),
        check('추세 기준 · HA 종가 > EMA55', aboveLongAverage, comparison(close, ema55)),
        check('보유 기준 · 직전·당일 HA 종가 모두 EMA55 위',
          Number.isFinite(previousClose) && Number.isFinite(previousEma55)
            ? previousClose > previousEma55 && close > ema55 : null,
          '직전 ' + comparison(previousClose, previousEma55) + ' · 당일 ' + comparison(close, ema55)),
        check('중장기 배열 · 단기 EMA 3개 모두 EMA55 위', averages.every(value => value > ema55),
          emaValues + ' · EMA55 ' + number(ema55)),
        check('단기 삼선 정배열 유지 · 꼬임 없음', crossed === null ? null : bullishOrder && !crossed,
          crossed === null ? '이평선 이력 부족' : `최근 ${SHORT_EMA_LOOKBACK}거래일 · ${crossed ? '교차 있음' : '교차 없음'} · ${bullishOrder ? '정배열' : '정배열 아님'}`),
        check('삼선 게이지 · 상승 캔들이며 HA 종가가 단기 EMA 3개와 EMA55 위', rising && above === 3 && aboveLongAverage,
          `${rising ? '상승' : '하락'} 캔들 · 3선 중 ${above}개 위 · EMA55 ${aboveLongAverage ? '위' : '이하'}`),
        check('MACD > 시그널', macd > signal, comparison(macd, signal, 3)),
        check('스토캐스틱 %K > %D', k > d, comparison(k, d)),
      ], {
        exitConditions: [check('하이킨아시 종가 < EMA55', close < ema55, comparison(close,ema55))],
      });
    }
    case 'trend': {
      const {close, s50, s150, s200, prior200, high, low, conditions} = result;
      const items = [
        ['종가 > 150일선과 200일선', '종가 ' + number(close) + ' · 150일 ' + number(s150) + ' · 200일 ' + number(s200)],
        ['150일선 > 200일선', comparison(s150, s200)],
        ['200일선이 21거래일 전보다 상승', '현재 ' + number(s200) + ' · 21거래일 전 ' + number(prior200)],
        ['50일선 > 150일선 > 200일선', [s50, s150, s200].map(value => number(value)).join(' / ')],
        ['종가 > 50일선', comparison(close, s50)],
        ['52주 저점 대비 30% 이상 상승', '저점 ' + number(low) + ' · ' + percent((close / low - 1) * 100)],
        ['52주 고점 대비 25% 이내', '고점 ' + number(high) + ' · ' + percent((close / high - 1) * 100)],
        ['SPY 대비 가중 상대강도 우위', conditions[7] === null ? '가중 산식 미확인' : 'SPY는 비교 기준과 동일'],
      ];
      return assessment(id, items.map(([label, value], i) => check(label, conditions[i], value)), {
        exitConditions: [check('종가 < 200일선 (이탈 참고)', close < s200, comparison(close,s200))],
      });
    }
    case 'box': {
      const {close, sma30, priorSma30, rising30, upper, lower, boxSource, volumeRatio} = result;
      const boxName = boxSource === 'manual' ? '직접 입력한 박스' : '추정 박스';
      return assessment(id, [
        check('종가 > 30주선', close > sma30, comparison(close, sma30)),
        check('30주선이 직전 주보다 상승', rising30, comparison(sma30, priorSma30)),
        check('종가 > ' + boxName + ' 상단', upper === null ? null : close > upper, comparison(close, upper)),
        check('거래량이 직전 50일 평균의 2배 이상', volumeRatio === null ? null : volumeRatio >= 2,
          volumeRatio === null ? '거래량 자료 부족' : number(volumeRatio, 1) + '배'),
      ], {tieBreaker: volumeRatio ?? 0,
        exitConditions: [check('종가 < ' + boxName + ' 하단', lower == null ? null : close < lower, comparison(close,lower))],
      });
    }
    case 'rsi2': {
      if (result.status === 'insufficient') throw Error('일봉이 최소 200개 필요합니다.');
      const {close, sma200, sma5, rsi, exit} = result;
      return assessment(id, [
        check('종가 > 200일선', close > sma200, comparison(close, sma200)),
        check('RSI(2) < 5', rsi < 5, 'RSI(2) ' + number(rsi, 1)),
      ], {exitConditions: [check('종가 > 5일선', exit, comparison(close, sma5))], tieBreaker: -rsi});
    }
    case 'breakout': {
      const {close, high20, high55, low10, low20, atr, signals} = result;
      return assessment(id, [
        check('시스템 1 · 종가 > 직전 20일 고점', signals.s1, comparison(close, high20)),
        check('시스템 2 · 종가 > 직전 55일 고점', signals.s2, comparison(close, high55)),
      ], {exitConditions: [
        check('시스템 1 · 종가 < 직전 10일 저점', signals.exitS1, comparison(close, low10)),
        check('시스템 2 · 종가 < 직전 20일 저점', signals.exitS2, comparison(close, low20)),
      ], tieBreaker: (close - high20) / atr});
    }
    default:
      throw Error('전략을 찾을 수 없습니다.');
  }
}

export function scoreStrategy(id, bars, symbol = '') {
  switch (id) {
    case '1000': return scoreAnalysis(id, analyze1000(bars));
    case 'trend': return scoreAnalysis(id, analyzeTrend(bars, {symbol}));
    case 'box': return scoreAnalysis(id, analyzeBox(bars));
    case 'rsi2': return scoreAnalysis(id, analyze(bars));
    case 'breakout': return scoreAnalysis(id, analyzeBreakout(bars, {includeLines: false}));
    default: throw Error('전략을 찾을 수 없습니다.');
  }
}

export function compareScores(a, b) {
  return (b.passed ?? -1) - (a.passed ?? -1) || (b.tieBreaker ?? 0) - (a.tieBreaker ?? 0) || a.symbol.localeCompare(b.symbol);
}
