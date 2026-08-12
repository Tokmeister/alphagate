import { ingestTradingViewSignal } from './tradingview-signal.js';
import { mapFromSeenObject, seenObjectFromMap } from './signal-store.js';

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
});

export async function handleTradingViewWebhook({ method, headers = {}, body = '', env = {}, store, now = Date.now() }) {
  if (method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  if (!env.TRADINGVIEW_WEBHOOK_SECRET) {
    return jsonResponse(500, { ok: false, reason: 'WEBHOOK_SECRET_NOT_CONFIGURED' });
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
  }

  const suppliedSecret = getHeader(headers, 'x-alphagate-secret')
    ?? getHeader(headers, 'x-tradingview-secret')
    ?? payload.secret;

  if (suppliedSecret !== env.TRADINGVIEW_WEBHOOK_SECRET) {
    return jsonResponse(401, { ok: false, reason: 'INVALID_WEBHOOK_SECRET' });
  }

  const publicPayload = { ...payload };
  delete publicPayload.secret;

  const seenObject = await store.getJSON('seen-signals') ?? {};
  const seenSignals = mapFromSeenObject(seenObject);
  const result = ingestTradingViewSignal(publicPayload, {
    now,
    seenSignals,
    duplicateTtlMs: env.DUPLICATE_SIGNAL_TTL_MS ? Number(env.DUPLICATE_SIGNAL_TTL_MS) : 120_000,
    validationOptions: {
      maxAgeMs: env.TRADINGVIEW_SIGNAL_MAX_AGE_MS ? Number(env.TRADINGVIEW_SIGNAL_MAX_AGE_MS) : 60_000
    }
  });

  const persisted = {
    ...result,
    receivedAt: new Date(now).toISOString(),
    mode: 'paper',
    broker: 'IBKR_LIVE_DISABLED'
  };

  await store.setJSON('seen-signals', seenObjectFromMap(seenSignals));
  await store.setJSON('latest-signal', persisted);

  return jsonResponse(result.accepted ? 202 : 200, {
    ok: result.accepted,
    state: result.state,
    reason: result.reason,
    signal: result.signal,
    mode: 'paper',
    broker: 'IBKR_LIVE_DISABLED'
  });
}

export async function handleLatestTradingViewSignal({ method, store }) {
  if (method !== 'GET') {
    return jsonResponse(405, { ok: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const latest = await store.getJSON('latest-signal');
  return jsonResponse(200, {
    ok: true,
    live: Boolean(latest),
    signal: latest ?? null,
    mode: 'paper',
    broker: 'IBKR_LIVE_DISABLED'
  });
}

export function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  };
}

function getHeader(headers, wanted) {
  const wantedLower = wanted.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === wantedLower) return value;
  }
  return null;
}
