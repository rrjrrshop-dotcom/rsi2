import {rateLimit} from './batch-scan.mjs';

export const MAX_FUNDAMENTALS_AGE_DAYS = 180;
const filings = new Set(['10-K', '10-Q', '20-F', '40-F', '6-K']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function daysBefore(date, days) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
}

function instantFacts(facts, unit, through) {
  const earliest = daysBefore(through, MAX_FUNDAMENTALS_AGE_DAYS);
  return (facts?.units?.[unit] ?? []).filter(fact =>
    !fact.start && Number.isFinite(fact.val) && datePattern.test(fact.end) && fact.end >= earliest &&
    fact.end <= through && datePattern.test(fact.filed) && fact.filed >= fact.end && fact.filed <= through &&
    typeof fact.accn === 'string' && filings.has(fact.form?.replace(/\/A$/, '')));
}

const latestFirst = (a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn);

/** Read point-in-time company-wide facts. Balance-sheet amounts must agree on filing, date and currency. */
export function readCompanyFacts(company, through) {
  const gaap = company.facts?.['us-gaap'];
  const ifrs = company.facts?.['ifrs-full'];
  const entityShares = instantFacts(company.facts?.dei?.EntityCommonStockSharesOutstanding, 'shares', through);
  const shares = (entityShares.length ? entityShares : instantFacts(gaap?.CommonStockSharesOutstanding, 'shares', through))
    .sort(latestFirst)[0];

  const balances = [
    {facts: gaap, ownerEquity: 'StockholdersEquity', totalEquity: 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
      currentAssets: 'AssetsCurrent', currentLiabilities: 'LiabilitiesCurrent'},
    {facts: ifrs, ownerEquity: 'EquityAttributableToOwnersOfParent', totalEquity: 'Equity',
      currentAssets: 'CurrentAssets', currentLiabilities: 'CurrentLiabilities'},
  ].flatMap(({facts, ownerEquity, totalEquity, currentAssets, currentLiabilities}) => Object.keys(facts?.Assets?.units ?? {}).flatMap(unit => {
    const values = tag => new Map(instantFacts(facts[tag], unit, through).map(fact => [`${fact.end}/${fact.accn}`, fact.val]));
    const liabilities = values('Liabilities');
    const owners = values(ownerEquity);
    const total = values(totalEquity);
    const liquidAssets = values(currentAssets);
    const shortTermLiabilities = values(currentLiabilities);
    return instantFacts(facts.Assets, unit, through).map(fact => {
      const key = `${fact.end}/${fact.accn}`;
      const equity = owners.get(key) ?? total.get(key);
      const combinedEquity = total.get(key);
      return {...fact, assets: fact.val, equity, liabilities: liabilities.get(key) ?? (fact.val - combinedEquity),
        currentAssets: liquidAssets.get(key) ?? null, currentLiabilities: shortTermLiabilities.get(key) ?? null};
    });
  }));
  const latest = balances.sort(latestFirst)[0];
  return {
    shares: shares?.val > 0 ? {count: shares.val, date: shares.end, filed: shares.filed, fromCover: entityShares.length > 0} : null,
    balance: latest?.assets > 0 && latest.liabilities >= 0 && Number.isFinite(latest.equity)
      ? {date: latest.end, assets: latest.assets, liabilities: latest.liabilities, equity: latest.equity,
        currentAssets: latest.currentAssets, currentLiabilities: latest.currentLiabilities}
      : null,
  };
}

const ambiguousInstrument = /\b(?:depositary|depository|ADSs?|ADRs?)\b/i;
const normalizeTicker = symbol => symbol.toUpperCase().replaceAll('.', '-');

/** Company-wide share counts are usable only where the SEC associates one ticker with the issuer. */
export function matchSecIssuers(securities, directory) {
  const tickersByCik = new Map();
  const cikByTicker = new Map();
  for (const {ticker, cik_str: cik} of Object.values(directory)) {
    if (typeof ticker !== 'string' || !Number.isInteger(cik) || cik <= 0) continue;
    const normalized = normalizeTicker(ticker);
    const tickers = tickersByCik.get(cik) ?? new Set();
    tickers.add(normalized);
    tickersByCik.set(cik, tickers);
    cikByTicker.set(normalized, cikByTicker.has(normalized) && cikByTicker.get(normalized) !== cik ? null : cik);
  }
  const matched = new Map();
  for (const security of securities) {
    if (security.kind !== 'stock' || ambiguousInstrument.test(security.name ?? '')) continue;
    const cik = cikByTicker.get(normalizeTicker(security.symbol));
    if (cik && tickersByCik.get(cik)?.size === 1) matched.set(security.symbol, cik);
  }
  return matched;
}

export async function loadSecFundamentals(securities, through, {fetcher = fetch, userAgent = process.env.SEC_USER_AGENT, directory} = {}) {
  if (typeof userAgent !== 'string' || !/^[^\r\n]+\s+[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userAgent.trim())) {
    throw Error('SEC_USER_AGENT에 앱 이름과 운영자 연락 이메일을 설정해야 합니다.');
  }
  const headers = {Accept: 'application/json', 'User-Agent': userAgent.trim()};
  const limitedFetch = rateLimit(fetcher, {intervalMs: 300});
  async function request(url) {
    const response = await limitedFetch(url, {headers, signal: AbortSignal.timeout(15000), redirect: 'error'});
    if (!response.ok) {
      const source = url.includes('company_tickers') ? '종목 목록' : '기업 재무자료';
      const error = new Error(`SEC ${source} 응답 오류 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  const tickerDirectory = directory ?? await request('https://www.sec.gov/files/company_tickers.json');
  const issuers = [...matchSecIssuers(securities, tickerDirectory)];
  if (!issuers.length) throw Error('자동 검색 대상의 SEC 공시 식별자를 확인할 수 없습니다.');

  const results = new Map();
  let next = 0;
  let failure;
  async function worker() {
    while (!failure && next < issuers.length) {
      const [symbol, cik] = issuers[next++];
      const id = String(cik).padStart(10, '0');
      try {
        const data = await request(`https://data.sec.gov/api/xbrl/companyfacts/CIK${id}.json`);
        if (Number(data.cik) !== cik || !data.facts) throw Error('SEC 공시 응답의 식별자가 일치하지 않습니다.');
        results.set(symbol, readCompanyFacts(data, through));
      } catch (error) {
        if (error.status === 404) continue;
        failure ??= error;
      }
    }
  }

  await Promise.all(Array.from({length: 4}, worker));
  if (failure) throw failure;
  return results;
}
