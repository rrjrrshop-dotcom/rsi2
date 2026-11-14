const stateFor = passed => passed === true ? 'pass' : passed === false ? 'fail' : 'unknown';
const states = {
  pass: {label: '충족', icon: 'M6 12l4 4 8-8'},
  fail: {label: '미충족', icon: 'M7 7l10 10M17 7L7 17'},
  unknown: {label: '미확인', icon: 'M8 12h8'},
};

export function scoreText(score) {
  if (!Number.isInteger(score?.passed) || !Number.isInteger(score.total) ||
      score.total < 1 || score.passed < 0 || score.passed > score.total) return '점수 확인 불가';
  return `${score.passed}/${score.total}점`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function renderScoreGraphic(score, {compact = false} = {}) {
  const graphic = element('span', compact ? 'score-graphic score-graphic-compact' : 'score-graphic');
  const text = scoreText(score);
  if (score?.note) graphic.title = score.note;
  graphic.append(element('span', 'score-fraction', text));
  if (!score?.conditions?.length) return graphic;
  const segments = element('span', 'score-segments');
  segments.setAttribute('aria-hidden', 'true');
  for (const condition of score.conditions) segments.append(element('span', `score-segment ${stateFor(condition.passed)}`));
  graphic.append(segments);
  return graphic;
}

function conditionIcon(state) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `condition-icon ${state}`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', states[state].icon);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function conditionList(conditions) {
  const list = element('ul', 'condition-list');
  for (const condition of conditions) {
    const state = stateFor(condition.passed);
    const row = element('li', `condition-row ${state}`);
    const label = element('span', 'condition-label', condition.label);
    if (condition.value) label.append(element('small', 'condition-value', condition.value));
    row.append(conditionIcon(state), label, element('span', 'condition-state', states[state].label));
    list.append(row);
  }
  return list;
}

export function renderScoreCard(score, {listsOnly = false} = {}) {
  const card = element('div', listsOnly ? 'score-card score-card-inline' : 'score-card');
  if (!listsOnly) {
    const header = element('div', 'score-card-header');
    header.append(element('h3', 'score-card-title', score.heading), renderScoreGraphic(score));
    card.append(header);
  }
  card.append(conditionList(score.conditions));
  if (score.note && !listsOnly) card.append(element('p', 'score-card-note', score.note));
  if (score.exitConditions?.length) {
    card.append(element('h4', 'condition-section-title', '보유 시 청산 조건'), conditionList(score.exitConditions));
  }
  return card;
}
