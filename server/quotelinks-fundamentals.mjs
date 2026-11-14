import {rateLimit} from './batch-scan.mjs';
import {daysBefore, matchSecIssuers, MAX_FUNDAMENTALS_AGE_DAYS} from './sec-fundamentals.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const reports = new Set(['10-K', '10-Q', '20-F', '40-F', '6-K']);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Original, unadjusted statements only. Future filings and stale periods cannot enter a historical screen. */
export function readQuotelinksFinancials(data, through) {
  if (data.basis !== 'original' || !['quarterly', 'annual'].includes(data.period) ||
      !/^[A-Z]{3}$/.test(data.currency ?? '') || !Array.isArray(data.periods)) {
    throw Error('재무자료의 통화·보고 기간·주식분할 기준을 확인할 수 없습니다.');
  }
  const earliest = daysBefore(through, MAX_FUNDAMENTALS_AGE_DAYS);
  const period = data.periods.filter(p => validDate(p.end) && p.end >= earliest && p.end <= through &&
    validDate(p.filed) && p.filed >= p.end && p.filed <= through && typeof p.accession === 'string' && p.accession &&
    reports.has(p.form?.replace(/\/A$/, '')))
    .sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0];
  if (!period) return {shares: null, balance: null};
  const notes = period.notes?.shares_outstanding ?? [];
  const shares = Number.isFinite(period.shares_outstanding) && period.shares_outstanding > 0 &&
    Array.isArray(notes) && !notes.some(note => ['split_adjusted', 'approximate', 'derived'].includes(note))
    ? {count: period.shares_outstanding, date: period.end, filed: period.filed, fromCover: false} : null;
  const balance = [period.total_assets, period.total_liabilities, period.equity].every(Number.isFinite) &&
    period.total_assets > 0 && period.total_liabilities >= 0
    ? {date: period.end, assets: period.total_assets, liabilities: period.total_liabilities, equity: period.equity,
      currentAssets: period.current_assets ?? null, currentLiabilities: period.current_liabilities ?? null} : null;
  return {shares, balance};
}

/** Quotelinks permits private, individual use. Never publish its raw financial responses. */
export async function loadQuotelinksFundamentals(securities, through, {directory, fetcher = fetch, wait = sleep, onProgress = () => {}, signal} = {}) {
  if (!directory) throw Error('재무자료를 연결할 기업 식별자 목록이 없습니다.');
  const issuers = [...matchSecIssuers(securities, directory)];
  if (!issuers.length) throw Error('자동 검색 대상의 공시 식별자를 확인할 수 없습니다.');
  const limitedFetch = rateLimit((url, options) => {
    signal?.throwIfAborted();
    return fetcher(url, options);
  }, {intervalMs: 550, sleep: wait});
  async function request(cik, period) {
    const url = `https://api.quotelinks.com/v1/financials/${cik}?period=${period}&basis=original`;
    for (let attempt = 0; ; attempt++) {
      const timeout = AbortSignal.timeout(20000);
      const response = await limitedFetch(url, {headers: {Accept: 'application/json'}, redirect: 'error',
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout});
      if (response.status === 404) return null;
      if (!response.ok) {
        if ([429, 502, 503, 504].includes(response.status) && attempt < 2) {
          const retry = response.headers?.get('retry-after');
          const milliseconds = retry == null ? 3000 * (attempt + 1) : /^\d+(\.\d+)?$/.test(retry)
            ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
          if (Number.isFinite(milliseconds) && milliseconds <= 120000) {
            await wait(Math.max(0, milliseconds));
            continue;
          }
        }
        throw Error(`Quotelinks 기업 재무자료 응답 오류 (${response.status})`);
      }
      const data = await response.json();
      if (Number(data.cik) !== cik || data.period !== period) throw Error('재무자료의 기업 식별자 또는 보고 기간이 일치하지 않습니다.');
      return readQuotelinksFinancials(data, through);
    }
  }
  const results = new Map();
  let next = 0, completed = 0, failure;
  async function worker() {
    while (!failure && next < issuers.length) {
      const [symbol, cik] = issuers[next++];
      try {
        let facts = await request(cik, 'quarterly');
        if (!facts || (!facts.shares && !facts.balance)) facts = await request(cik, 'annual');
        if (facts) results.set(symbol, facts);
        onProgress({completed: ++completed, total: issuers.length});
      } catch (error) { failure ??= error; }
    }
  }
  await Promise.all(Array.from({length: 4}, worker));
  if (failure) throw failure;
  return results;
}
