import {scoreText} from './score-card.mjs';

const charts = {1000: 'n1000Chart', trend: 'trendChart', box: 'boxChart', rsi2: 'priceChart', breakout: 'breakoutChart'};
const conditionColors = {
  pass: ['#d9f5ea', '#135e49', '충족'],
  fail: ['#fce5e8', '#9e2f3a', '미충족'],
  unknown: ['#e8eff0', '#506165', '미확인'],
};

function lines(ctx, text, width) {
  const output = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width > width && line) { output.push(line); line = word; }
    else line = next;
  }
  if (line) output.push(line);
  return output;
}

function drawCondition(ctx, condition, y) {
  const state = condition.passed === true ? 'pass' : condition.passed === false ? 'fail' : 'unknown';
  const [fill, stroke, label] = conditionColors[state];
  ctx.fillStyle = fill;
  ctx.fillRect(65, y - 18, 23, 23);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (state === 'pass') {
    ctx.moveTo(71, y - 7); ctx.lineTo(75, y - 3); ctx.lineTo(83, y - 11);
  } else if (state === 'fail') {
    ctx.moveTo(72, y - 11); ctx.lineTo(81, y - 2);
    ctx.moveTo(81, y - 11); ctx.lineTo(72, y - 2);
  } else {
    ctx.moveTo(72, y - 7); ctx.lineTo(81, y - 7);
  }
  ctx.stroke();
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#162432';
  ctx.fillText(condition.label, 101, y);
  ctx.fillStyle = stroke;
  ctx.fillText(label, 1082, y);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#465b65';
  ctx.fillText(condition.value, 101, y + 22);
}

export async function saveReport(id, record) {
  if (!record?.score) throw Error('먼저 종목을 조회하세요.');
  if (!window.PDFLib) throw Error('PDF 기능을 불러오지 못했습니다.');
  const chart = document.getElementById(charts[id]);
  if (!chart?.width || !chart.height) throw Error('차트를 먼저 불러오세요.');
  if (id === 'rsi2' && document.getElementById('chartSymbol').value !== record.symbol) {
    throw Error('PDF에는 점수와 같은 종목의 차트를 선택해 주세요.');
  }
  const page = document.createElement('canvas');
  page.width = 1240;
  page.height = 1754;
  const ctx = page.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.fillStyle = '#162432';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(record.symbol + '  |  ' + id, 65, 85);
  ctx.font = '23px sans-serif';
  ctx.fillText('기준일 ' + record.date + '  ·  ' + scoreText(record.score), 65, 130);
  ctx.fillStyle = record.color;
  ctx.fillRect(40, 160, 8, 1400);
  ctx.fillStyle = '#162432';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(record.score.heading, 65, 195);
  let y = 236;
  for (const condition of record.score.conditions) {
    drawCondition(ctx, condition, y);
    y += 55;
  }
  if (record.score.note) {
    ctx.font = '19px sans-serif';
    ctx.fillText(record.score.note, 65, y);
    y += 36;
  }
  if (record.score.exitConditions?.length) {
    ctx.fillStyle = '#162432';
    ctx.font = 'bold 23px sans-serif';
    ctx.fillText('보유 시 청산 조건', 65, y);
    y += 38;
    for (const condition of record.score.exitConditions) {
      drawCondition(ctx, condition, y);
      y += 55;
    }
  }
  const height = Math.min(560, chart.height * 1100 / chart.width);
  ctx.fillStyle = '#f7f8fa';
  ctx.fillRect(65, y, 1100, height);
  ctx.drawImage(chart, 65, y, 1100, height);
  y += height + 43;
  ctx.fillStyle = '#162432';
  ctx.font = 'bold 25px sans-serif';
  ctx.fillText('상황별 참고', 65, y);
  y += 32;
  ctx.font = '20px sans-serif';
  for (const line of lines(ctx, record.advice, 1100).slice(0, Math.max(0, Math.floor((1635 - y) / 27)))) {
    ctx.fillText(line, 65, y);
    y += 27;
  }
  ctx.fillStyle = '#475569';
  ctx.font = '18px sans-serif';
  ctx.fillText('확정 일봉 기준 · 전략 조건 충족 수', 65, 1680);
  const pdf = await window.PDFLib.PDFDocument.create();
  const sheet = pdf.addPage([595.28,841.89]);
  const img = await pdf.embedJpg(page.toDataURL('image/jpeg',.92));
  sheet.drawImage(img, {x: 0, y: 0, width: 595.28, height: 841.89});
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = record.symbol + '-' + id + '-' + record.date + '.pdf';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
