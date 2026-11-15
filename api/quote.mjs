import {constantTimeEqual} from '../server/subscriptions.mjs';
import {adjustBreakoutBars, BREAKOUT_ADJUSTMENT} from '../breakout.mjs';
import {easternDate, dataAgeDays, isMarketDate} from '../server/trading-calendar.mjs';
import {marketCache, pricesThrough, dividendsThrough, SAVED_MARKET_SOURCE} from '../server/market-cache.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'GET 요청만 지원합니다.'});
  if (!process.env.PAIRING_SECRET) return res.status(503).json({error: '개인 접근 설정이 필요합니다.'});
  if (!constantTimeEqual(req.headers?.authorization || '', `Bearer ${process.env.PAIRING_SECRET}`)) {
    return res.status(401).json({error: '개인 등록 코드가 올바르지 않습니다.'});
  }
  const symbol = String(req.query?.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) return res.status(400).json({error: '올바른 티커를 입력하세요.'});
  const pinned = req.query?.through;
  const today = easternDate();
  if (pinned !== undefined && (!isMarketDate(pinned) || pinned > today)) {
    return res.status(400).json({error: '확정 종가의 기준일을 확인하세요.'});
  }
  try {
    const store = marketCache();
    const current = await store.current();
    if (!current) return res.status(503).json({error: '첫 일봉 저장이 진행 중입니다. 저장 완료 후 조회할 수 있습니다.'});
    const requestedThrough = pinned ?? current.through;
    if (requestedThrough > current.through) return res.status(404).json({error: '요청 기준일의 확정 종가가 아직 저장되지 않았습니다.'});
    const record = await store.record(current, symbol);
    if (!record?.bars.length) return res.status(404).json({error: '이 종목의 저장된 일봉을 찾을 수 없습니다.'});
    let bars = pricesThrough(record, requestedThrough);
    const through = bars.at(-1)?.date;
    if (!through || (pinned && through !== pinned)) return res.status(404).json({error: '추천 기준일의 저장된 종가가 없습니다.'});
    let adjustment = 'split-adjusted';
    if (req.query.strategy === 'breakout') {
      try { bars = adjustBreakoutBars(bars, dividendsThrough(record, through)); }
      catch (error) { return res.status(502).json({error: error.message}); }
      adjustment = BREAKOUT_ADJUSTMENT;
    }
    const ageDays = dataAgeDays(through, today);
    return res.status(200).json({symbol, bars, source: SAVED_MARKET_SOURCE, through, requestedThrough,
      marketThrough: current.through, marketReceivedAt: current.receivedAt, ageDays,
      staleWarning: through < requestedThrough || ageDays > 7, adjustment});
  } catch {
    return res.status(503).json({error: '저장된 종가를 읽을 수 없습니다. 잠시 후 다시 시도하세요.'});
  }
}
