import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectionTarget, tradingWeekdays} from './trading-calendar.mjs';
import {readSession} from '../scripts/scan.mjs';

test('schedule collects at 11am Korea Tuesday to Saturday', async () => {
  const yml = await readFile(new URL('../.github/workflows/daily.yml', import.meta.url), 'utf8');
  assert.match(yml, /0 2 \* \* 2-6/);
  assert.match(yml, /30 7 \* \* 2-6/);
  assert.equal(collectionTarget(new Date('2026-11-17T01:29:00Z')), '2026-11-13');
  assert.equal(collectionTarget(new Date('2026-11-17T01:30:00Z')), '2026-11-16');
  assert.equal(collectionTarget(new Date('2026-11-17T05:30:00Z')), '2026-11-16');
  assert.equal(collectionTarget(new Date('2026-07-07T00:30:00Z')), '2026-07-06');
  assert.equal(collectionTarget(new Date('2026-11-15T20:30:00Z')), '2026-11-13');
  assert.deepEqual(tradingWeekdays('2026-11-12','2026-11-17'), ['2026-11-13','2026-11-16','2026-11-17']);
});

test('a retry reuses the one confirmed market batch even before recommendation publication', async () => {
  const date = '2026-11-16', values = new Map(), requests = [];
  const cache = {session: async date => values.get(date), saveSession: async (date, value) => values.set(date, value)};
  const now = new Date('2026-11-17T01:30:00Z');
  const client = {dailyMarket: async (date, {adjusted}) => {
    requests.push([date, adjusted]);
    return [{symbol: 'SPY', close: 700}];
  }};
  const close = await readSession(cache, client, date, now);
  const retry = await readSession(cache, client, date, now);
  assert.equal(retry, close);
  assert.deepEqual(requests, [[date, false]]);
  const missing = await readSession(cache, {dailyMarket: async () => []}, '2026-11-17', new Date('2026-11-18T01:30:00Z'));
  assert.equal(missing.rows.length, 0);
  assert.equal(values.has('2026-11-17'), false);
});
