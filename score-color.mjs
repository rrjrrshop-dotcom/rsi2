import {scoreAnalysis, scoreStrategy} from './scores.mjs';
import {renderScoreCard} from './score-card.mjs';
import {explainStrategy} from './advice.mjs';
import {saveReport} from './export-pdf.mjs';

const palette = ['#ff0000','#ff3900','#ff8c00','#ffc000','#fff000','#c4e52a','#70cc3f','#00bd58','#009e8d'];
const neutral = '#87929b';
const config = {
  1000: {form: 'n1000Form', result: 'n1000Summary', chart: 'n1000Chart', heading: 'n1000Headline'},
  trend: {form: 'trendForm', result: 'trendResult', chart: 'trendChart', heading: 'trendHeadline'},
  box: {form: 'boxForm', result: 'boxResult', chart: 'boxChart', heading: 'boxHeadline'},
  rsi2: {form: 'symbolForm', result: 'quickResult', chart: 'priceChart', heading: 'quickResult'},
  breakout: {form: 'breakoutForm', result: 'breakoutResult', chart: 'breakoutChart', heading: 'breakoutHeadline'},
};
const panels = {};

export function scoreColor(score) {
  if (!score?.total || !score.conditions.some(condition => condition.passed !== null)) return neutral;
  return palette[Math.round(score.passed / score.total * (palette.length - 1))];
}

function showAnalysis(id, bars, symbol, analysis, withReport = true) {
  const {panel, slot, pdf, adviceNode} = panels[id];
  let advice = '분석 데이터가 부족하여 조건을 확인할 수 없습니다.';
  try { advice = explainStrategy(id, bars, symbol, analysis); } catch {}
  let score = null;
  try { score = analysis ? scoreAnalysis(id, analysis) : scoreStrategy(id, bars, symbol); } catch {}
  const color = scoreColor(score);
  panel.style.borderLeftColor = color;
  if (score) slot.replaceChildren(renderScoreCard(score));
  else slot.textContent = '점수 확인 불가 · 일봉 자료 부족';
  adviceNode.textContent = advice;
  pdf.disabled = !withReport || !score;
  return {symbol, date: analysis?.date ?? bars.at(-1)?.date ?? '날짜 미확인', score, color, advice};
}

window.updateStrategyColor = (id, bars, symbol, analysis) => {
  panels[id].record = showAnalysis(id, bars, symbol, analysis);
};
// CSV summaries already contain the RSI(2) values. Their chart selector can be on another symbol.
window.showCsvConditions = (row, singleSymbol) => {
  if (!row || row.count !== undefined) return;
  const result = {close: row.close, sma200: row.s200, sma5: row.s5, rsi: row.rsi, exit: row.exit, date: row.date,
    status: row.status === '매수 신호' ? 'buy' : 'wait'};
  panels.rsi2.record = showAnalysis('rsi2', [], row.sym, result, singleSymbol);
};
window.clearStrategyScore = id => {
  const {panel, slot, pdf, adviceNode} = panels[id];
  panels[id].record = null;
  pdf.disabled = true;
  adviceNode.textContent = '';
  panel.style.borderLeftColor = neutral;
  slot.replaceChildren();
};

for (const [id, entry] of Object.entries(config)) {
  const result = document.getElementById(entry.result);
  const panel = id === 'rsi2' ? result.closest('section') : result;
  const slot = document.createElement('div');
  slot.className = 'score-caption';
  document.getElementById(entry.heading).insertAdjacentElement('afterend', slot);
  const adviceNode = document.createElement('p');
  adviceNode.className = 'strategy-advice note';
  document.getElementById(entry.chart).insertAdjacentElement('afterend', adviceNode);
  const pdf = document.createElement('button');
  pdf.id = 'pdf-' + id;
  pdf.type = 'button';
  pdf.className = 'secondary';
  pdf.textContent = 'PDF 저장';
  pdf.disabled = true;
  pdf.addEventListener('click', async () => {
    try { await saveReport(id, panels[id].record); }
    catch (error) { alert(error.message); }
  });
  slot.insertAdjacentElement('afterend', pdf);
  panel.classList.add('score-color-panel');
  panels[id] = {panel, slot, adviceNode, pdf, record: null};
  document.getElementById(entry.form).addEventListener('submit', () => window.clearStrategyScore(id));
}
