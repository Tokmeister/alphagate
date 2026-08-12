import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIbkrSession,
  createIbkrConfig,
  fetchIbkrSnapshot,
  getIbkrReadiness,
  IBKR_STATES,
  normalizeIbkrQuote
} from '../src/ibkr-client-portal.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

test('IBKR config is disabled by default and never tradable', () => {
  const config = createIbkrConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.liveExecutionEnabled, false);
  assert.equal(getIbkrReadiness(config).state, IBKR_STATES.DISABLED);
});

test('IBKR readiness fails closed when enabled without base URL', () => {
  const config = createIbkrConfig({ ALPHAGATE_IBKR_MARKET_DATA: 'true' });
  const readiness = getIbkrReadiness(config);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.tradable, false);
  assert.equal(readiness.reason, 'IBKR_BASE_URL_MISSING');
});

test('IBKR session check reports connected but still not directly tradable', async () => {
  const config = createIbkrConfig({
    ALPHAGATE_IBKR_MARKET_DATA: 'true',
    IBKR_CLIENT_PORTAL_BASE_URL: 'https://localhost:5000/v1/api'
  });

  const result = await checkIbkrSession({
    config,
    fetchImpl: async () => jsonResponse({ authenticated: true, competing: false })
  });

  assert.equal(result.state, IBKR_STATES.CONNECTED);
  assert.equal(result.ready, true);
  assert.equal(result.tradable, false);
});

test('IBKR session check fails closed on auth required', async () => {
  const config = createIbkrConfig({
    ALPHAGATE_IBKR_MARKET_DATA: 'true',
    IBKR_CLIENT_PORTAL_BASE_URL: 'https://localhost:5000/v1/api'
  });

  const result = await checkIbkrSession({
    config,
    fetchImpl: async () => jsonResponse({ authenticated: false })
  });

  assert.equal(result.state, IBKR_STATES.AUTH_REQUIRED);
  assert.equal(result.ready, false);
});

test('normalizes an IBKR quote into AlphaGate market-data shape', () => {
  const quote = normalizeIbkrQuote({
    symbol: 'cba',
    currency: 'aud',
    last: '180.50',
    timestamp: '2026-08-12T01:00:00.000Z'
  });

  assert.equal(quote.source, 'Interactive Brokers');
  assert.equal(quote.symbol, 'CBA');
  assert.equal(quote.currency, 'AUD');
  assert.equal(quote.price, 180.5);
  assert.equal(quote.simulated, false);
});

test('fetch snapshot fails closed when gateway is disabled', async () => {
  const result = await fetchIbkrSnapshot({ symbol: 'CBA', currency: 'AUD', config: createIbkrConfig({}) });
  assert.equal(result.ibkr.state, IBKR_STATES.DISABLED);
  assert.equal(result.assessment.tradable, false);
});

test('fetch snapshot returns live market-data assessment only after session and snapshot succeed', async () => {
  const config = createIbkrConfig({
    ALPHAGATE_IBKR_MARKET_DATA: 'true',
    IBKR_CLIENT_PORTAL_BASE_URL: 'https://localhost:5000/v1/api'
  });
  const now = Date.parse('2026-08-12T01:00:00.000Z');

  const calls = [];
  const result = await fetchIbkrSnapshot({
    conid: '12345',
    symbol: 'CBA',
    currency: 'AUD',
    config,
    now,
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith('/iserver/auth/status')) return jsonResponse({ authenticated: true, competing: false });
      return jsonResponse([{ symbol: 'CBA', '31': 180.5, timestamp: '2026-08-12T01:00:00.000Z' }]);
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.ibkr.reason, 'IBKR_SNAPSHOT_RECEIVED');
  assert.equal(result.assessment.state, 'LIVE');
  assert.equal(result.assessment.tradable, true);
});
