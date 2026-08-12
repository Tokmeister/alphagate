import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ingestTradingViewSignal,
  normalizeTradingViewSignal,
  validateTradingViewSignal
} from '../src/tradingview-signal.js';

const now = Date.parse('2026-08-12T07:00:00.000Z');

function basePayload(overrides = {}) {
  return {
    symbol: 'CBA',
    action: 'LONG',
    price: 180.4,
    timeframe: '5m',
    receivedAt: new Date(now).toISOString(),
    source: 'TradingView',
    ...overrides
  };
}

describe('TradingView signal validation', () => {
  it('accepts a fresh valid TradingView signal', () => {
    const signal = normalizeTradingViewSignal(basePayload(), now);
    const result = validateTradingViewSignal(signal, now);
    assert.equal(result.accepted, true);
    assert.equal(result.state, 'ACCEPTED');
  });

  it('rejects invalid action', () => {
    const signal = normalizeTradingViewSignal(basePayload({ action: 'BUY_NOW' }), now);
    const result = validateTradingViewSignal(signal, now);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'INVALID_ACTION');
  });

  it('rejects stale signals', () => {
    const signal = normalizeTradingViewSignal(basePayload({ receivedAt: new Date(now - 120_001).toISOString() }), now);
    const result = validateTradingViewSignal(signal, now);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'SIGNAL_STALE');
  });

  it('rejects missing symbol', () => {
    const signal = normalizeTradingViewSignal(basePayload({ symbol: '' }), now);
    const result = validateTradingViewSignal(signal, now);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'MISSING_SYMBOL');
  });

  it('rejects invalid price', () => {
    const signal = normalizeTradingViewSignal(basePayload({ price: 0 }), now);
    const result = validateTradingViewSignal(signal, now);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'INVALID_PRICE');
  });

  it('blocks duplicate signals within the duplicate window', () => {
    const seenSignals = new Map();
    const first = ingestTradingViewSignal(basePayload({ id: 'fixed-signal-id' }), { now, seenSignals });
    const second = ingestTradingViewSignal(basePayload({ id: 'fixed-signal-id' }), { now: now + 1000, seenSignals });

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(second.state, 'DUPLICATE');
    assert.equal(second.reason, 'DUPLICATE_SIGNAL');
  });
});
