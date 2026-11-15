export function redisRest({url, token, fetcher = fetch}) {
  let origin;
  try {
    const base = new URL(url);
    if (base.protocol === 'https:' && base.hostname.endsWith('.upstash.io') && !base.username && !base.password) {
      origin = base.origin;
    }
  } catch {}
  if (!origin || !token) throw Error('result storage not configured');
  async function request(args, path = '') {
    let response;
    try {
      response = await fetcher(path ? origin + path : origin, {
        method: 'POST',
        headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw Error('result storage unavailable');
    }
    if (!response.ok) throw Error(`result storage unavailable (${response.status})`);
    return response.json();
  }
  return {
    async command(args) {
      const body = await request(args);
      if (body.error) throw Error('result storage unavailable');
      return body.result;
    },
    async transaction(commands) {
      const rows = await request(commands, '/multi-exec');
      if (!Array.isArray(rows) || rows.length !== commands.length || rows.some(row => row.error)) {
        throw Error('result storage transaction failed');
      }
      return rows.map(row => row.result);
    },
  };
}

export function redisSettings(env = process.env) {
  return {url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN};
}
