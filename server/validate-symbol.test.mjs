import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/validate-symbol.mjs';

test('registration rejects invalid tickers before accessing storage', async () => {
  const previous = process.env.PAIRING_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.PAIRING_SECRET = 'test';
  try {
    globalThis.fetch = () => assert.fail('unexpected request');
    const res = {
      statusCode: 200, setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json() {},
    };
    await handler({method:'GET', headers:{authorization:'Bearer test'}, query:{symbol:'BAD!'}}, res);
    assert.equal(res.statusCode, 400);
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.PAIRING_SECRET;
    else process.env.PAIRING_SECRET = previous;
  }
});
