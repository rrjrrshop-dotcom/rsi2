export const HOLDING_ENTRY_THRESHOLD = 90;

export function scoreOutOf100(score) {
  const {passed, total} = score ?? {};
  if (!Number.isInteger(passed) || !Number.isInteger(total) ||
      total < 1 || passed < 0 || passed > total) return null;
  return passed / total * 100;
}

export function scoreText(score) {
  const points = scoreOutOf100(score);
  if (points === null) return '점수 확인 불가';
  return `${score.passed}/${score.total}점 · ${Number(points.toFixed(1))}점`;
}
