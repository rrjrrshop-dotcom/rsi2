import {analyze} from './server/signals.mjs';
import {analyze1000} from './strategy1000.mjs';
import {estimate1000Score} from './strategy1000-score.mjs';
import {analyzeTrend} from './trend.mjs';
import {analyzeBox} from './box.mjs';
import {analyzeBreakout} from './breakout.mjs';

const number = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—';
const comparison = (left, right, digits) => number(left, digits) + ' / ' + number(right, digits);
const percent = value => (value >= 0 ? '+' : '') + number(value, 1) + '%';
const check = (label, passed, value = '') => ({label, passed: passed ?? null, value});

function assessment(heading, conditions, {exitConditions = [], note = '', tieBreaker = 0} = {}) {
  return {heading, passed: conditions.filter(condition => condition.passed === true).length,
    total: conditions.length, conditions, exitConditions, note, tieBreaker};
}

/** Use the same condition results in detail views, watchlists, recommendations and exports. */
export function scoreAnalysis(id, result) {
  switch (id) {
    case '1000': {
      const estimate = estimate1000Score(result);
      return assessment('일봉 조건', estimate.checks.map(({name, passed, left, right}) =>
        check(name, passed, comparison(left, right, name.startsWith('MACD') ? 3 : 2))), {
        note: estimate.score === null ? '' : '가중 추정 스코어 ' + estimate.score + '/9점',
        tieBreaker: estimate.score ?? 0,
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
      return assessment('추세 조건', items.map(([label, value], i) => check(label, conditions[i], value)));
    }
    case 'box': {
      const {close, sma30, priorSma30, rising30, upper, boxSource, volumeRatio} = result;
      const boxName = boxSource === 'manual' ? '직접 입력한 박스' : '추정 박스';
      return assessment('박스 돌파 조건', [
        check('종가 > 30주선', close > sma30, comparison(close, sma30)),
        check('30주선이 직전 주보다 상승', rising30, comparison(sma30, priorSma30)),
        check('종가 > ' + boxName + ' 상단', upper === null ? null : close > upper, comparison(close, upper)),
        check('거래량이 직전 50일 평균의 2배 이상', volumeRatio === null ? null : volumeRatio >= 2,
          volumeRatio === null ? '거래량 자료 부족' : number(volumeRatio, 1) + '배'),
      ], {tieBreaker: volumeRatio ?? 0});
    }
    case 'rsi2': {
      if (result.status === 'insufficient') throw Error('일봉이 최소 200개 필요합니다.');
      const {close, sma200, sma5, rsi, exit} = result;
      return assessment('진입 조건', [
        check('종가 > 200일선', close > sma200, comparison(close, sma200)),
        check('RSI(2) < 5', rsi < 5, 'RSI(2) ' + number(rsi, 1)),
      ], {exitConditions: [check('종가 > 5일선', exit, comparison(close, sma5))], tieBreaker: -rsi});
    }
    case 'breakout': {
      const {close, high20, high55, low10, low20, atr} = result;
      return assessment('돌파 진입 조건', [
        check('시스템 1 · 종가 > 직전 20일 고점', close > high20, comparison(close, high20)),
        check('시스템 2 · 종가 > 직전 55일 고점', close > high55, comparison(close, high55)),
      ], {exitConditions: [
        check('시스템 1 · 종가 < 직전 10일 저점', close < low10, comparison(close, low10)),
        check('시스템 2 · 종가 < 직전 20일 저점', close < low20, comparison(close, low20)),
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
