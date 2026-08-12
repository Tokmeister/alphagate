import test from 'node:test';
import assert from 'node:assert/strict';
import { assessMarketData, FEED_STATES } from '../src/market-data.js';
import { evaluatePaperEligibility } from '../src/paper-gate.js';

const now = Date.parse('2026-08-12T07:00:00.000Z');
const signal = { action: 'LONG', symbol: 'CBA' };

test('fresh simulated data is clearly labelled and cannot create a paper trade', () => {
  const marketData = assessMarketData({
    source: 'simulated',
    symbol: 'CBA',
    currency: 'AUD',
    price: 180,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    simulated: true,
    now
  });

  assert.equal(marketData.state, FEED_STATES.SIMULATED);
  assert.equal(marketData.tradable, false);

  const decision = evaluatePaperEligibility({ signal, marketData, riskApproved: true });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'SIMULATED_FEED_NOT_TRADEABLE');
});

test('stale data blocks paper trade eligibility', () => {
  const marketData = assessMarketData({
    source: 'provider',
    symbol: 'CBA',
    currency: 'AUD',
    price: 180,
    timestamp: new Date(now - 60_000).toISOString(),
    marketOpen: true,
    simulated: false,
    now,
    maxAgeMs: 10_000
  });

  assert.equal(marketData.state, FEED_STATES.STALE);
  assert.equal(marketData.tradable, false);

  const decision = evaluatePaperEligibility({ signal, marketData, riskApproved: true });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'DATA_STALE');
});

test('disconnected data blocks paper trade eligibility', () => {
  const marketData = assessMarketData({
    source: null,
    symbol: 'CBA',
    currency: 'AUD',
    price: 180,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    now
  });

  assert.equal(marketData.state, FEED_STATES.DISCONNECTED);
  assert.equal(marketData.tradable, false);

  const decision = evaluatePaperEligibility({ signal, marketData, riskApproved: true });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'MISSING_SOURCE_SYMBOL_OR_CURRENCY');
});

test('only fresh live market data can pass the market-data gate', () => {
  const marketData = assessMarketData({
    source: 'verified-provider',
    symbol: 'CBA',
    currency: 'AUD',
    price: 180,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    simulated: false,
    now
  });

  assert.equal(marketData.state, FEED_STATES.LIVE);
  assert.equal(marketData.tradable, true);

  const decision = evaluatePaperEligibility({ signal, marketData, riskApproved: true });
  assert.equal(decision.eligible, true);
  assert.equal(decision.decision, 'PAPER_ELIGIBLE');
});
