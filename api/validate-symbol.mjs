import {constantTimeEqual} from '../server/subscriptions.mjs';
import {marketCache} from '../server/market-cache.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'GET 요청만 지원합니다.'});
  if (!process.env.PAIRING_SECRET) return res.status(503).json({error: '개인 접근 설정이 필요합니다.'});
  if (!constantTimeEqual(req.headers?.authorization || '', `Bearer ${process.env.PAIRING_SECRET}`)) {
    return res.status(401).json({error: '개인 등록 코드가 올바르지 않습니다.'});
  }
  const symbol = String(req.query?.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,15}$/.test(symbol)) return res.status(400).json({error: '올바른 티커 형식이 아닙니다.'});
  try {
    const store = marketCache();
    const current = await store.current();
    if (!current) return res.status(503).json({error: '첫 일봉 저장이 완료되면 종목을 등록할 수 있습니다.'});
    const item = await store.record(current, symbol);
    if (!item?.type) return res.status(404).json({error: '저장된 미국 상장 종목에서 이 티커를 찾을 수 없습니다.'});
    return res.status(200).json({symbol, name: item.name || symbol, type: item.type});
  } catch {
    return res.status(503).json({error: '저장된 종목 정보를 읽을 수 없습니다.'});
  }
}
