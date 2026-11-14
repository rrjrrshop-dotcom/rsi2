import {RECOMMENDATION_INDEXES} from '../recommendation-policy.mjs';

const nasdaqList = 'https://api.nasdaq.com/api/quote/list-type/nasdaq100';
const sizes = {nasdaq100: [100, 105], sp500: [500, 510], dow: [30, 30]};

export function assertIndexSize(index, count) {
  const [min, max] = sizes[index] ?? [];
  if (min === undefined || !Number.isInteger(count) || count < min || count > max) {
    throw Error(`${RECOMMENDATION_INDEXES[index] ?? index} constituent list is incomplete or unexpected (${count})`);
  }
}

export async function fetchNasdaq100Index({fetcher = fetch, now = () => new Date()} = {}) {
  const response = await fetcher(nasdaqList, {
    headers: {Accept: 'application/json', 'User-Agent': 'Stocking/1.0'},
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) throw Error(`Nasdaq-100 constituent list unavailable (${response.status})`);
  const {data} = await response.json();
  const rows = data?.data?.rows;
  if (!Array.isArray(rows) || rows.length !== data.totalrecords || Number(data.offset ?? 0) !== 0) {
    throw Error('Nasdaq-100 constituent list is incomplete');
  }
  assertIndexSize('nasdaq100', rows.length);
  const time = now();
  const quoteDate = typeof data.date === 'string' ? data.date.match(/^[A-Za-z]{3} \d{1,2}, \d{4}/)?.[0] : null;
  const asOf = quoteDate ? Date.parse(`${quoteDate} UTC`) : NaN;
  if (!Number.isFinite(asOf) || asOf > time.getTime() + 86400000 || time.getTime() - asOf > 14 * 86400000) {
    throw Error('Nasdaq-100 constituent list is stale');
  }
  const seen = new Set();
  const securities = rows.map(row => {
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol) || seen.has(symbol) || typeof row.companyName !== 'string' || !row.companyName.trim()) {
      throw Error('Nasdaq-100 constituent list contains an invalid or duplicate listing');
    }
    seen.add(symbol);
    return {symbol, name: row.companyName.trim(), kind: 'stock'};
  });
  return {securities, asOf: new Date(asOf).toISOString().slice(0, 10), retrievedAt: time.toISOString(),
    source: 'Nasdaq', official: true, page: 'https://www.nasdaq.com/market-activity/quotes/nasdaq-ndx-index'};
}

/** Construct the recommendation universe solely from the three validated index lists. */
export function indexRecommendationUniverse(securities) {
  const indexSymbols = Object.fromEntries(Object.keys(RECOMMENDATION_INDEXES).map(index => [index, new Set()]));
  const bySymbol = new Map();
  for (const security of securities) {
    if (!Array.isArray(security.sources)) continue;
    const indexes = Object.keys(RECOMMENDATION_INDEXES).filter(index => security.sources.includes(index));
    if (!indexes.length) continue;
    bySymbol.set(security.symbol, {...security, indexes});
    for (const index of indexes) indexSymbols[index].add(security.symbol);
  }
  const counts = Object.fromEntries(Object.entries(indexSymbols).map(([index, symbols]) => [index, symbols.size]));
  for (const [index, count] of Object.entries(counts)) assertIndexSize(index, count);
  return {securities: [...bySymbol.values()], counts};
}
