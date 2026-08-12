import { assessMarketData } from './market-data.js';

export const IBKR_STATES = Object.freeze({
  DISABLED: 'DISABLED',
  CONFIGURED: 'CONFIGURED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR'
});

export function createIbkrConfig(env = process.env) {
  const baseUrl = env.IBKR_CLIENT_PORTAL_BASE_URL ?? '';
  return {
    enabled: env.ALPHAGATE_IBKR_MARKET_DATA === 'true',
    baseUrl: baseUrl.replace(/\/$/, ''),
    accountId: env.IBKR_ACCOUNT_ID ?? null,
    liveExecutionEnabled: false,
    source: 'IBKR_CLIENT_PORTAL'
  };
}

export function getIbkrReadiness(config = createIbkrConfig()) {
  if (!config.enabled) {
    return {
      state: IBKR_STATES.DISABLED,
      ready: false,
      tradable: false,
      reason: 'IBKR_MARKET_DATA_DISABLED'
    };
  }

  if (!config.baseUrl) {
    return {
      state: IBKR_STATES.ERROR,
      ready: false,
      tradable: false,
      reason: 'IBKR_BASE_URL_MISSING'
    };
  }

  return {
    state: IBKR_STATES.CONFIGURED,
    ready: true,
    tradable: false,
    reason: 'IBKR_GATEWAY_STATUS_NOT_VERIFIED'
  };
}

export async function checkIbkrSession({ config = createIbkrConfig(), fetchImpl = fetch } = {}) {
  const readiness = getIbkrReadiness(config);
  if (!readiness.ready) return readiness;

  try {
    const response = await fetchImpl(`${config.baseUrl}/iserver/auth/status`, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return {
        state: IBKR_STATES.ERROR,
        ready: false,
        tradable: false,
        reason: `IBKR_AUTH_STATUS_HTTP_${response.status}`
      };
    }

    const body = await response.json();
    const authenticated = body.authenticated === true || body.competing === false;

    if (!authenticated) {
      return {
        state: IBKR_STATES.AUTH_REQUIRED,
        ready: false,
        tradable: false,
        reason: 'IBKR_AUTH_REQUIRED',
        body
      };
    }

    return {
      state: IBKR_STATES.CONNECTED,
      ready: true,
      tradable: false,
      reason: 'IBKR_SESSION_CONNECTED_MARKET_DATA_NOT_YET_VERIFIED',
      body
    };
  } catch (error) {
    return {
      state: IBKR_STATES.ERROR,
      ready: false,
      tradable: false,
      reason: 'IBKR_SESSION_CHECK_FAILED',
      error: error.message
    };
  }
}

export function normalizeIbkrQuote(snapshot = {}, now = Date.now()) {
  const symbol = String(snapshot.symbol ?? snapshot.localSymbol ?? snapshot.ticker ?? '').trim().toUpperCase();
  const currency = String(snapshot.currency ?? '').trim().toUpperCase();
  const price = Number(snapshot.last ?? snapshot.price ?? snapshot.lastPrice ?? snapshot.close);
  const timestamp = snapshot.timestamp ?? snapshot.time ?? new Date(now).toISOString();

  return {
    source: 'Interactive Brokers',
    symbol,
    currency,
    price,
    timestamp,
    marketOpen: snapshot.marketOpen !== false,
    simulated: false,
    raw: snapshot
  };
}

export async function fetchIbkrSnapshot({ conid, symbol, currency = 'AUD', config = createIbkrConfig(), fetchImpl = fetch, now = Date.now() } = {}) {
  const session = await checkIbkrSession({ config, fetchImpl });
  if (session.state !== IBKR_STATES.CONNECTED) {
    return {
      quote: null,
      assessment: assessMarketData({
        source: 'Interactive Brokers',
        symbol: symbol ?? '',
        currency,
        price: NaN,
        timestamp: new Date(now).toISOString(),
        marketOpen: false,
        now
      }),
      ibkr: session
    };
  }

  if (!conid) {
    return {
      quote: null,
      assessment: assessMarketData({
        source: 'Interactive Brokers',
        symbol: symbol ?? '',
        currency,
        price: NaN,
        timestamp: new Date(now).toISOString(),
        marketOpen: false,
        now
      }),
      ibkr: { state: IBKR_STATES.ERROR, ready: false, reason: 'IBKR_CONID_REQUIRED' }
    };
  }

  try {
    const url = `${config.baseUrl}/iserver/marketdata/snapshot?conids=${encodeURIComponent(conid)}&fields=31,55,70,71,84,86,6509`;
    const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' } });

    if (!response.ok) {
      return {
        quote: null,
        assessment: assessMarketData({
          source: 'Interactive Brokers',
          symbol: symbol ?? '',
          currency,
          price: NaN,
          timestamp: new Date(now).toISOString(),
          marketOpen: false,
          now
        }),
        ibkr: { state: IBKR_STATES.ERROR, ready: false, reason: `IBKR_SNAPSHOT_HTTP_${response.status}` }
      };
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    const quote = normalizeIbkrQuote({
      symbol: row.symbol ?? row['55'] ?? symbol,
      currency,
      last: row.last ?? row['31'],
      timestamp: row.timestamp ?? row.updated ?? new Date(now).toISOString(),
      marketOpen: true,
      raw: row
    }, now);

    return {
      quote,
      assessment: assessMarketData({ ...quote, now }),
      ibkr: { state: IBKR_STATES.CONNECTED, ready: true, reason: 'IBKR_SNAPSHOT_RECEIVED' }
    };
  } catch (error) {
    return {
      quote: null,
      assessment: assessMarketData({
        source: 'Interactive Brokers',
        symbol: symbol ?? '',
        currency,
        price: NaN,
        timestamp: new Date(now).toISOString(),
        marketOpen: false,
        now
      }),
      ibkr: { state: IBKR_STATES.ERROR, ready: false, reason: 'IBKR_SNAPSHOT_FAILED', error: error.message }
    };
  }
}
