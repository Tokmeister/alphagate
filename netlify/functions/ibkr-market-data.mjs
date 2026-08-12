import { fetchIbkrSnapshot, createIbkrConfig, getIbkrReadiness } from '../../src/ibkr-client-portal.js';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const config = createIbkrConfig(process.env);
  const url = new URL(request.url);
  const conid = url.searchParams.get('conid');
  const symbol = url.searchParams.get('symbol') ?? '';
  const currency = url.searchParams.get('currency') ?? 'AUD';

  const readiness = getIbkrReadiness(config);
  if (!readiness.ready) {
    return json({
      provider: 'Interactive Brokers',
      mode: 'market-data-only',
      liveExecutionEnabled: false,
      readiness,
      assessment: {
        state: 'DISCONNECTED',
        tradable: false,
        reason: readiness.reason
      }
    });
  }

  const result = await fetchIbkrSnapshot({ conid, symbol, currency, config });
  return json({
    provider: 'Interactive Brokers',
    mode: 'market-data-only',
    liveExecutionEnabled: false,
    ...result
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    }
  });
}
