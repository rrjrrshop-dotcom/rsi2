import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketCache} from './market-cache.mjs';
import quote from '../api/quote.mjs';
import frame from '../api/frame-context.mjs';
import validate from '../api/validate-symbol.mjs';
import results from '../api/results.mjs';

function response() {
  return {headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }};
}
const settings = {url: 'https://example.upstash.io', token: 'storage-secret'};
const headers = {authorization: 'Bearer test-personal-code'};
const days = ['2026-11-04','2026-11-05','2026-11-06','2026-11-09'];

test('private saved market history drives all quote and recommendation requests', async () => {
  const originalFetch = globalThis.fetch;
  const env = {
    PAIRING_SECRET: 'test-personal-code',
    UPSTASH_REDIS_REST_URL: settings.url,
    UPSTASH_REDIS_REST_TOKEN: settings.token,
  };
  const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const strings = new Map(), hashes = new Map(), commands = [];
  function execute([command, key, ...args]) {
    commands.push(command);
    switch (command) {
      case 'GET': return strings.get(key) ?? null;
      case 'SET': strings.set(key, args[0]); return 'OK';
      case 'HSET': {
        const hash = hashes.get(key) ?? new Map();
        for (let i = 0; i < args.length; i += 2) hash.set(args[i], args[i + 1]);
        hashes.set(key, hash);
        return args.length / 2;
      }
      case 'HGET': return hashes.get(key)?.get(args[0]) ?? null;
      case 'HGETALL': return [...(hashes.get(key) ?? [])].flat();
      case 'PERSIST': case 'EXPIRE': return 1;
      case 'DEL': strings.delete(key); hashes.delete(key); return 1;
      default: throw Error(command);
    }
  }
  const call = async (handler, query = {}, units = headers, method = 'GET') => {
    const res = response();
    await handler({method, query, headers: units}, res);
    return res;
  };
  try {
    Object.assign(process.env, env);
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).origin, settings.url, 'quote and search use only saved storage');
      assert.equal(options.headers.Authorization, 'Bearer ' + settings.token);
      const request = JSON.parse(options.body);
      if (new URL(url).pathname === '/multi-exec') return {ok: true, json: async () => request.map(args => ({result: execute(args)}))};
      return {ok: true, json: async () => ({result: execute(request)})};
    };
    for (const handler of [quote, frame, validate, results]) {
      assert.equal((await call(handler, {symbol: 'UGI'}, {authorization: 'Bearer wrong'})).statusCode, 401);
    }
    assert.equal(commands.length, 0);
    const store = marketCache();
    assert.equal((await call(quote, {symbol:'UGI'})).statusCode, 503);
    const original = {name: 'UGI Corporation', type: 'CS',
      bars: days.map((date, i) => ({date, open: 100, high: 103, low: 98, close: 100, volume: 100 + i})).slice(0, 3),
      dividends: [{date: days[1], amount: 2, cashAmount: 4, currency: 'USD'},
        {date: days[2], amount: 25, cashAmount: 25, currency: 'USD'}],
    };
    const receivedAt = '2026-11-06T23:00:00Z';
    const meta = await store.stage({dates: days.slice(0, 3), history: new Map([['UGI', original]]), receivedAt});
    assert.equal(await store.current(), null);
    const expectedFrame = {status:'available', trend:'상승', date:days[2]};
    await store.publish(meta, {expectedDate: days[2], total: 1, buy: []}, {UGI: expectedFrame}, null);
    assert.deepEqual(await store.current(), meta);
    assert.deepEqual((await store.histories(meta)).get('UGI').bars, original.bars);
    const saved = await call(results);
    const manual = await call(quote, {symbol:'ugi'});
    assert.equal(saved.statusCode, 200);
    assert.equal(manual.statusCode, 200);
    assert.equal(manual.body.through, saved.body.expectedDate);
    assert.equal(saved.body.marketReceivedAt, receivedAt);
    assert.match(manual.body.source, /일일 저장본/);
    assert.equal(manual.body.bars[0].close, 100);
    assert.equal(manual.body.adjustment, 'split-adjusted');
    assert.equal(manual.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify({manual, saved}).includes(settings.token));
    const checked = await call(validate, {symbol:'UGI'});
    assert.deepEqual(checked.body, {symbol:'UGI',name:original.name,type:'CS'});
    assert.equal((await call(validate, {symbol:'MISSING'})).statusCode, 404);
    const compared = await call(frame, {symbol:'UGI',through:days[2]});
    assert.deepEqual(compared.body.context, expectedFrame);
    assert.equal((await call(frame, {symbol:'UGI',through:days[1]})).statusCode, 404);
    const beforePublish = await call(quote, {symbol:'UGI',through:days[3]});
    assert.equal(beforePublish.statusCode, 404);
    assert.equal((await call(quote, {symbol:'UGI',through:'2026-02-30'})).statusCode, 400);
    const next = {...original, bars: [...original.bars, {date: days[3],open:50,high:52,low:49,close:51,volume:200}],
      splits: [{date: days[3], from:1, to:2}]};
    const nextMeta = await store.stage({dates: days, history: new Map([['UGI', next]]),receivedAt});
    assert.equal((await call(quote, {symbol:'UGI'})).body.through, days[2]);
    await store.publish(nextMeta, {expectedDate:days[3],total:1,buy:[]}, {}, meta);
    const latest = await call(quote, {symbol:'UGI'});
    assert.deepEqual(latest.body.bars.map(b => b.close), [50,50,50,51]);
    assert.equal(latest.body.bars[0].volume, 200);
    const pinned = await call(quote, {symbol:'UGI',through:days[2],strategy:'breakout'});
    assert.equal(pinned.body.adjustment, 'split-and-dividend-adjusted');
    assert.deepEqual(pinned.body.bars.map(b => b.close), [96,100,100]);
    assert.equal((await call(quote, {symbol:'UGI',through:'2026-11-07'})).statusCode, 404);
    assert.equal((await call(quote, {symbol:'MISSING'})).statusCode, 404);
    await assert.rejects(store.publish(meta,{expectedDate:days[2],total:1,buy:[]},{},nextMeta), /게시 순서/);

    const scanDays = Array.from({length: 60}, (_, i) => new Date(Date.UTC(2026, 10, 10-59+i)).toISOString().slice(0,10));
    const scanDate = scanDays.at(-1);
    const symbols = Array.from({length: 11}, (_, i) => 'LOW'+i);
    const history = new Map([...symbols, 'HIGH'].map(symbol => [symbol, {...original, dividends: [],
      bars: scanDays.map((date, i) => ({date, open:100, low:99, high:symbol === 'HIGH' && i === 59 ? 105 : 102,
        close:symbol === 'HIGH' && i === 59 ? 105 : 100, volume:1000})),
    }]));
    const scanMeta = await store.stage({dates:scanDays,history,receivedAt});
    const candidates = ['MISSING', ...symbols, 'HIGH'].map(symbol => ({symbol,date:scanDate}));
    const buy = [{symbol:'RSI',date:scanDate,close:110,sma200:90,sma5:120,rsi:4,exit:false}];
    await store.publish(scanMeta,{expectedDate:scanDate,total:13,buy,preliminary:{breakout:candidates}},{},nextMeta);
    const first = await call(results,{strategy:'breakout',page:0});
    const second = await call(results,{strategy:'breakout',page:1});
    assert.equal(first.statusCode,200);
    assert.equal(first.body.pages,2);
    assert.equal(first.body.rows[0].passed,2);
    assert.deepEqual(first.body.rows.map(row => row.symbol),['HIGH', ...symbols]);
    assert.deepEqual(second.body.rows,[{symbol:'MISSING'}]);
    const rsi = await call(results,{strategy:'rsi2'});
    assert.equal(rsi.body.rows[0].passed,2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
