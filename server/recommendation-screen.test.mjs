import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readCompanyFacts, matchSecIssuers, loadSecFundamentals} from './sec-fundamentals.mjs';
import {screenRecommendations} from './recommendation-screen.mjs';
import {scanGrouped} from './grouped-scan.mjs';
import {compactScan} from './result-store.mjs';

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
  assert.deepEqual(summary, {version: 1, status: 'applied', through, stocks: 11, comparable: 10, excludedSmall: 4, excludedFinancials: 3, eligible: 3});
});

test('production scan ranks only eligible stocks and persists six recommendations for each strategy', async () => {
  const symbols = ['BAD', 'GOODA', 'GOODB', 'GOODC', 'GOODD', 'GOODE', 'GOODF', 'GOODG'];
  const dates = [];
  for (let day = 0; dates.length < 260; day++) {
    const date = new Date(Date.UTC(2025, 0, day + 1));
    if (date.getUTCDay() % 6 !== 0) dates.push(date.toISOString().slice(0, 10));
  }
  const scan = await scanGrouped({symbols, dates, recommendationSymbols: Promise.resolve(new Set(symbols.slice(1))),
    getDaily: async date => symbols.map((symbol, i) => {
      const close = 50 + dates.indexOf(date) * 0.3 + i * 0.01;
      return {symbol, close, open: close, high: close + 1, low: close - 1, volume: 1000};
    }),
  });
  assert.equal(scan.total, 8);
  for (const rows of Object.values(compactScan(scan).preliminary.recommendations)) {
    assert.equal(rows.length, 6);
    assert.ok(rows.every(row => row.symbol.startsWith('GOOD')));
    assert.ok(rows.every((row, i) => !i || rows[i - 1].score >= row.score));
  }
});

test('SEC access failure stops recommendation screening instead of using a partially loaded market', async () => {
  await assert.rejects(loadSecFundamentals([{symbol: 'AAA', kind: 'stock'}], through, {fetcher: async url => {
    if (url.includes('company_tickers')) return {ok: true, json: async () => ({0: {ticker: 'AAA', cik_str: 1}})};
    return {ok: false, status: 403};
  }}), /403/);
});
