import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readCompanyFacts, matchSecIssuers, loadSecFundamentals} from './sec-fundamentals.mjs';
import {screenRecommendations} from './recommendation-screen.mjs';
import {scanGrouped} from './grouped-scan.mjs';
import {compactScan} from './result-store.mjs';
import {makeMarketData} from './market-data.mjs';
import {RECOMMENDATION_SCREEN_VERSION} from '../recommendation-policy.mjs';

const through = '2026-11-12';
const fact = (val, overrides = {}) => ({val, end: '2026-09-30', filed: '2026-10-29', accn: 'report', form: '10-Q', ...overrides});
const tag = (unit, ...facts) => ({units: {[unit]: facts}});
const company = (overrides = {}) => ({cik: 1, facts: {
  dei: {EntityCommonStockSharesOutstanding: tag('shares', fact(100, {end: '2026-10-28'}), fact(999, {end: '2026-11-11', filed: '2026-11-13'}))},
  'us-gaap': {
    Assets: tag('USD', fact(1000), fact(3000, {end: '2026-10-31', filed: '2026-11-14'})),
    Liabilities: tag('USD', fact(600), fact(995, {accn: 'unrelated'})),
    StockholdersEquity: tag('USD', fact(400)),
    AssetsCurrent: tag('USD', fact(240)),
    LiabilitiesCurrent: tag('USD', fact(200)),
    ...overrides,
  },
}});

test('SEC balances use the same filing and currency, excluding filings published after the close date', () => {
  const facts = readCompanyFacts(company(), through);
  assert.deepEqual(facts.shares, {count: 100, date: '2026-10-28', filed: '2026-10-29', fromCover: true});
  assert.deepEqual(facts.balance, {date: '2026-09-30', assets: 1000, liabilities: 600, equity: 400, currentAssets: 240, currentLiabilities: 200});
  assert.equal(readCompanyFacts(company({Liabilities: tag('EUR', fact(600))}), through).balance, null);
  assert.deepEqual(readCompanyFacts(company(), '2027-08-01'), {shares: null, balance: null});
});

test('issuer matching avoids applying company-wide shares to preferred shares, depositary receipts, or multiple listings', () => {
  const directory = {
    0: {ticker: 'AAA', cik_str: 1}, 1: {ticker: 'AAB', cik_str: 1},
    2: {ticker: 'BB-A', cik_str: 2}, 3: {ticker: 'ADR', cik_str: 3}, 4: {ticker: 'PREF', cik_str: 4},
  };
  const securities = [
    {symbol: 'AAA', kind: 'stock'}, {symbol: 'BB.A', kind: 'stock'},
    {symbol: 'ADR', kind: 'stock', name: 'Example American Depositary Shares'}, {symbol: 'PREF', kind: 'preferred'},
  ];
  assert.deepEqual([...matchSecIssuers(securities, directory)], [['BB.A', 2]]);
});

test('filter adjusts shares for splits, removes bottom 30% with ties, and excludes weak or missing balances', () => {
  const sizes = [1, 2, 3, 3, 5, 6, 7, 8, 9, 10];
  const securities = sizes.map((_, i) => ({symbol: `ST${i}`, kind: 'stock'}));
  securities.push({symbol: 'ETF', kind: 'etf'}, {symbol: 'UNKNOWN', kind: 'stock'});
  const facts = new Map(sizes.map((count, i) => [`ST${i}`, {
    shares: {count, date: '2026-10-28', filed: '2026-10-29', fromCover: true},
    balance: i === 6 ? null : {assets: 1000, liabilities: 600, equity: i === 4 ? -2 : 400, currentAssets: i === 5 ? 50 : 200, currentLiabilities: 100},
  }]));
  const closes = new Map(securities.map(({symbol}) => [symbol, 10]));
  closes.set('ST9', 5);
  const splits = new Map([['ST9', [{date: '2026-11-01', from: 1, to: 2}]]]);
  const {eligible, summary} = screenRecommendations(securities, facts, closes, splits, through);
  assert.deepEqual([...eligible], ['ST7', 'ST8', 'ST9']);
  assert.deepEqual(summary, {version: RECOMMENDATION_SCREEN_VERSION, status: 'applied', through, stocks: 11, comparable: 10, excludedSmall: 4, excludedFinancials: 3, eligible: 3});
  const market = screenRecommendations(securities, facts, closes, splits, through, 0.20);
  assert.deepEqual([...market.eligible], ['ST2', 'ST3', 'ST7', 'ST8', 'ST9']);
  assert.equal(market.summary.excludedSmall, 2);
});

test('recommendations require both verified index membership and eligibility, and retain the scored conditions', async () => {
  const symbols = ['BAD', 'NONMEMBER', 'INVALID', 'GOODA', 'GOODB', 'GOODC', 'GOODD', 'GOODE', 'GOODF', 'GOODG'];
  const dates = [];
  for (let day = 0; dates.length < 260; day++) {
    const date = new Date(Date.UTC(2025, 0, day + 1));
    if (date.getUTCDay() % 6 !== 0) dates.push(date.toISOString().slice(0, 10));
  }
  const scan = await scanGrouped({symbols, dates, marketSymbols: ['MARKET', 'SMALL'],
    getRecommendationCandidates: async () => ({major: new Set(symbols.slice(1)), all: new Set(['MARKET', 'GOODA'])}),
    recommendationMembership: new Map([['BAD', ['sp500']], ['INVALID', ['nasdaq']], ...symbols.slice(3).map(s => [s, ['nasdaq100','sp500']])]),
    getDaily: async date => [...symbols, 'MARKET', 'SMALL'].map((symbol, i) => {
      const close = 50 + dates.indexOf(date) * 0.3 + i * 0.01;
      return {symbol, close, open: close, high: close + 1, low: close - 1, volume: 1000};
    }),
  });
  assert.equal(scan.total, symbols.length);
  const saved = compactScan(scan).preliminary;
  for (const [id, rows] of Object.entries(saved.recommendations)) {
    assert.equal(rows.length, 6);
    assert.ok(rows.every(row => row.symbol.startsWith('GOOD')));
    assert.ok(rows.every(row => row.indexes.length === 2 && row.conditions.length === row.total));
    assert.ok(rows.every((row, i) => !i || rows[i - 1].passed >= row.passed));
    assert.equal(rows[0].total, {'1000':7, trend:8, box:4, rsi2:2, breakout:2}[id]);
    assert.deepEqual(saved.marketRecommendations[id].map(row => row.symbol).sort(), ['GOODA', 'MARKET']);
    assert.deepEqual(saved.marketRecommendations[id].find(row => row.symbol === 'MARKET').indexes, []);
  }
});

test('SEC access failure stops recommendation screening instead of using a partially loaded market', async () => {
  const userAgent = 'Stocking tests support@example.com';
  await assert.rejects(loadSecFundamentals([{symbol: 'AAA', kind: 'stock'}], through, {userAgent, fetcher: async (url, options) => {
    assert.equal(options.headers['User-Agent'], userAgent);
    if (url.includes('company_tickers')) return {ok: true, json: async () => ({0: {ticker: 'AAA', cik_str: 1}})};
    return {ok: false, status: 403};
  }}), /403/);
});

test('SEC requests require a declared app and operator contact before any network access', async () => {
  for (const userAgent of ['', 'Stocking (https://example.com)', 'Stocking contact@example.com\r\nextra']) {
    await assert.rejects(loadSecFundamentals([], through, {userAgent, fetcher: async () => assert.fail('unexpected request')}), /SEC_USER_AGENT/);
  }
});

test('Massive issuer identifiers use all pages and the SEC loader accepts the verified directory', async () => {
  const called = [];
  const row = (ticker, cik) => ({ticker, cik, name: ticker + ' Inc.', primary_exchange: 'XNYS',
    type: 'CS', market: 'stocks', locale: 'us', active: true});
  const client = makeMarketData({key: 'test-key', fetcher: async url => {
    called.push(url);
    return {ok: true, json: async () => called.length === 1
      ? {results: [row('AAA', '0000000001')], next_url: 'https://api.massive.com/v3/reference/tickers?cursor=second'}
      : {results: [row('BBB', '0000000002'), row('NEW'), {...row('OTC'), market: 'otc'}, {...row('ETF'), type: 'ETF'}]}};
  }});
  const directory = await client.stockDirectory(through);
  assert.equal(called[0].searchParams.get('date'), through);
  assert.equal(called.length, 2);
  assert.deepEqual(directory, [
    {ticker: 'AAA', cik_str: 1, name: 'AAA Inc.', exchange: 'XNYS'},
    {ticker: 'BBB', cik_str: 2, name: 'BBB Inc.', exchange: 'XNYS'},
    {ticker: 'NEW', cik_str: null, name: 'NEW Inc.', exchange: 'XNYS'},
  ]);
  const results = await loadSecFundamentals([{symbol: 'AAA', kind: 'stock'}], through, {
    userAgent: 'Stocking tests support@example.com', directory,
    fetcher: async url => {
      assert.equal(url, 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json');
      return {ok: true, json: async () => company()};
    },
  });
  assert.equal(results.get('AAA').balance.equity, 400);
  let requests = 0;
  const unsafe = makeMarketData({key: 'test-key', fetcher: async () => {
    requests++;
    return {ok: true, json: async () => ({results: [], next_url: 'https://example.com/v3/reference/tickers?cursor=second'})};
  }});
  await assert.rejects(unsafe.stockDirectory(through), /다음 페이지/);
  assert.equal(requests, 1);
});
