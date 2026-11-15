import {constantTimeEqual} from '../server/subscriptions.mjs';
import {easternDate, isMarketDate} from '../server/trading-calendar.mjs';
import {marketCache, SAVED_MARKET_SOURCE} from '../server/market-cache.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'GET 요청만 지원합니다.'});
  if (!process.env.PAIRING_SECRET || !constantTimeEqual(req.headers?.authorization || '', `Bearer ${process.env.PAIRING_SECRET}`)) {
    return res.status(401).json({error: '개인 등록 코드가 올바르지 않습니다.'});
  }
  const symbol = String(req.query?.symbol || '').trim().toUpperCase();
  const through = req.query?.through;
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol) || !isMarketDate(through) || through > easternDate()) {
    return res.status(400).json({error: '티커 또는 기준일을 확인하세요.'});
  }
  try {
    const store = marketCache();
    const current = await store.current();
    if (current?.through === through) {
      const frames = await store.frames(current);
      if (Object.hasOwn(frames, symbol)) {
        return res.status(200).json({symbol, context: frames[symbol], source: SAVED_MARKET_SOURCE, asOf: through});
      }
    }
    return res.status(404).json({error: '이 종목의 저장된 15분봉 비교 자료가 없습니다.'});
  } catch {
    return res.status(503).json({error: '저장된 15분봉 비교 자료를 읽을 수 없습니다.'});
  }
}
