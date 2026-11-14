import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readQuotelinksFinancials, loadQuotelinksFundamentals} from './quotelinks-fundamentals.mjs';
import {screenRecommendations} from './recommendation-screen.mjs';

const through = '2026-11-12';
const period = changes => ({end: '2026-09-30', filed: '2026-10-29', accession: 'report', form: '10-Q',
  total_assets: 1000, total_liabilities: 600, equity: 400, current_assets: 240, current_liabilities: 200,
  shares_outstanding: 100, ...changes});
const data = (periods = [period()], changes) => ({cik: 1, currency: 'USD', period: 'quarterly', basis: 'original', periods, ...changes});
const securities = [{symbol: 'AAA', kind: 'stock'}];
const directory = [{ticker: 'AAA', cik_str: 1}];
const ok = body => ({ok: true, status: 200, json: async () => body});

test('alternative source excludes future filings and stale balances, preserving unadjusted share provenance', () => {
  const actual = readQuotelinksFinancials(data([period({end: '2026-10-31', filed: '2026-11-14', equity: -5}), period()]), through);
  assert.deepEqual(actual, {
    shares: {count: 100, date: '2026-09-30', filed: '2026-10-29', fromCover: false},
    balance: {date: '2026-09-30', assets: 1000, liabilities: 600, equity: 400, currentAssets: 240, currentLiabilities: 200},
  });
  assert.deepEqual(readQuotelinksFinancials(data(), '2027-08-01'), {shares: null, balance: null});
  assert.deepEqual(readQuotelinksFinancials(data([period({end: '2026-09-31'})]), through), {shares: null, balance: null});
  assert.throws(() => readQuotelinksFinancials(data(undefined, {basis: 'latest'}), through), /주식분할/);
});

test('missing or adjusted share counts never become a zero or a double split-adjusted market cap', () => {
  for (const shares_outstanding of [null, undefined, 0, -1, '100']) {
    assert.equal(readQuotelinksFinancials(data([period({shares_outstanding})]), through).shares, null);
  }
  for (const note of ['split_adjusted', 'approximate', 'derived']) {
    assert.equal(readQuotelinksFinancials(data([period({notes: {shares_outstanding: [note]}})]), through).shares, null);
  }
  const facts = new Map([['AAA', readQuotelinksFinancials(data(), through)]]);
  const screen = screenRecommendations(securities, facts, new Map([['AAA', 10]]),
    new Map([['AAA', [{date: '2026-10-20', from: 1, to: 5}]]]), through);
  assert.equal(screen.summary.comparable, 0);
});

test('a newer incomplete balance does not silently fall back to an older healthy balance', () => {
  const result = readQuotelinksFinancials(data([period(), period({end: '2026-10-31', filed: '2026-11-10', total_liabilities: null})]), through);
  assert.equal(result.balance, null);
  assert.equal(result.shares.date, '2026-10-31');
});

test('unknown quarterly filings can fall back to annual filings without treating other HTTP errors as missing issuers', async () => {
  const calls = [];
  const result = await loadQuotelinksFundamentals(securities, through, {directory, wait: async () => {}, fetcher: async url => {
    calls.push(url);
    return url.includes('period=quarterly') ? {ok: false, status: 404} : ok(data([period({form: '10-K'})], {period: 'annual'}));
  }});
  assert.equal(calls.length, 2);
  assert.ok(calls.every(url => url.includes('basis=original')));
  assert.equal(result.get('AAA').balance.equity, 400);
  await assert.rejects(loadQuotelinksFundamentals(securities, through, {directory, fetcher: async () => ({ok: false, status: 403})}), /403/);
  await assert.rejects(loadQuotelinksFundamentals(securities, through, {directory, fetcher: async () => ok(data(undefined, {cik: 999}))}), /식별자/);
});

test('rate-limited requests honor Retry-After with bounded retries', async () => {
  let calls = 0;
  const waits = [];
  const result = await loadQuotelinksFundamentals(securities, through, {directory, wait: async ms => waits.push(ms), fetcher: async () => {
    if (++calls === 1) return {ok: false, status: 429, headers: {get: () => '2'}};
    return ok(data());
  }});
  assert.equal(result.size, 1);
  assert.equal(calls, 2);
  assert.ok(waits.includes(2000));
});
