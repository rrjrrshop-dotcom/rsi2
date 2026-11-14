import {priorEasternDay, dataAgeDays} from './quote.mjs';
import {constantTimeEqual} from '../server/subscriptions.mjs';
import {resultStore} from '../server/result-store.mjs';
import {hasCurrentRecommendationScreen, RECOMMENDATION_SCOPES} from '../recommendation-policy.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({error: '지원하지 않는 요청입니다.'});
  if (!process.env.PAIRING_SECRET || !constantTimeEqual(req.headers.authorization || '', `Bearer ${process.env.PAIRING_SECRET}`)) {
    return res.status(401).json({error: '등록 코드가 올바르지 않습니다.'});
  }
  try {
    const store = resultStore({url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN});
    if (req.method === 'POST') {
      await store.save(req.body);
      return res.status(200).json({ok: true});
    }
    const result = await store.load();
    if (!result) return res.status(404).json({error: '아직 저장된 검색 결과가 없습니다.'});
    if (result.preliminary) {
      for (const [scope, {list}] of Object.entries(RECOMMENDATION_SCOPES)) {
        if (!hasCurrentRecommendationScreen(result, scope)) result.preliminary[list] = {};
      }
    }
    const ageDays = dataAgeDays(result.expectedDate, priorEasternDay());
    return res.status(200).json({...result, ageDays, staleWarning: ageDays > 7});
  } catch {
    return res.status(503).json({error: '검색 결과 저장소에 연결하지 못했습니다.'});
  }
}
