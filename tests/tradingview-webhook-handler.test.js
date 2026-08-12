import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemorySignalStore } from '../src/signal-store.js';
import { handleLatestTradingViewSignal, handleTradingViewWebhook } from '../src/tradingview-webhook-handler.js';

const env = {
  TRADINGVIEW_WEBHOOK_SECRET: 'test-secret',
  TRADINGVIEW_SIGNAL_MAX_AGE_MS: '60000',
  DUPLICATE_SIGNAL_TTL_MS: '120000'
};

function payload(overrides = {}) {
  return JSON.stringify({
    secret: 'test-secret',
    id: 'CBA-LONG-1',
    symbol: 'CBA',
    action: 'LONG',
    price: 180.5,
    timeframe: '5m',
    receivedAt: new Date(1_000_000).toISOString(),
    ...overrides
  });
}

test('webhook rejects unsupported methods', async () => {
  const response = await handleTradingViewWebhook({ method: 'GET', env, store: createMemorySignalStore(), now: 1_000_000 });
  assert.equal(response.statusCode, 405);
});

test('webhook requires configured secret', async () => {
  const response = await handleTradingViewWebhook({
    method: 'POST',
    body: payload(),
    env: {},
    store: createMemorySignalStore(),
    now: 1_000_000
  });
  assert.equal(response.statusCode, 500);
  assert.equal(JSON.parse(response.body).reason, 'WEBHOOK_SECRET_NOT_CONFIGURED');
});

test('webhook rejects invalid secret', async () => {
  const response = await handleTradingViewWebhook({
    method: 'POST',
    body: payload({ secret: 'wrong' }),
    env,
    store: createMemorySignalStore(),
    now: 1_000_000
  });
  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).reason, 'INVALID_WEBHOOK_SECRET');
});

test('webhook accepts valid signal and persists latest', async () => {
  const store = createMemorySignalStore();
  const response = await handleTradingViewWebhook({
    method: 'POST',
    body: payload(),
    env,
    store,
    now: 1_000_000
  });
  const result = JSON.parse(response.body);
  assert.equal(response.statusCode, 202);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'ACCEPTED');

  const latestResponse = await handleLatestTradingViewSignal({ method: 'GET', store });
  const latest = JSON.parse(latestResponse.body);
  assert.equal(latest.live, true);
  assert.equal(latest.signal.state, 'ACCEPTED');
  assert.equal(latest.signal.broker, 'IBKR_LIVE_DISABLED');
});

test('webhook stores duplicate signal as blocked latest state', async () => {
  const store = createMemorySignalStore();
  await handleTradingViewWebhook({ method: 'POST', body: payload(), env, store, now: 1_000_000 });
  const duplicate = await handleTradingViewWebhook({ method: 'POST', body: payload(), env, store, now: 1_000_500 });
  const result = JSON.parse(duplicate.body);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(result.ok, false);
  assert.equal(result.state, 'DUPLICATE');
  assert.equal(result.reason, 'DUPLICATE_SIGNAL');

  const latest = JSON.parse((await handleLatestTradingViewSignal({ method: 'GET', store })).body);
  assert.equal(latest.signal.state, 'DUPLICATE');
});

test('latest endpoint is GET only', async () => {
  const response = await handleLatestTradingViewSignal({ method: 'POST', store: createMemorySignalStore() });
  assert.equal(response.statusCode, 405);
});
