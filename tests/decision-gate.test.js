import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessMarketData } from '../src/market-data.js';
import { evaluateDecisionGate } from '../src/decision-gate.js';
import { ingestTradingViewSignal } from '../src/tradingview-signal.js';

const now = Date.parse('2026-08-12T07:00:00.000Z');

function validSignal(symbol = 'CBA') {
  return ingestTradingViewSignal({
    id: `${symbol}-long-${now}`,
    source: 'TradingView',
    symbol,
    action: 'LONG',
    price: 180.4,
    timeframe: '5m',
    receivedAt: new Date(now).toISOString()
  }, { now, seenSignals: new Map() });
}

function liveAssessment() {
  return assessMarketData({
    source: 'Verified test provider',
    symbol: 'CBA',
    currency: 'AUD',
    price: 180.4,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    simulated: false,
    now
  });
}

function simulatedAssessment() {
  return assessMarketData({
    source: 'AlphaGate simulated feed',
    symbol: 'CBA',
    currency: 'AUD',
    price: 180.4,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    simulated: true,
    now
  });
}

const candidate = {
  ticker: 'CBA',
  score: 84
};

describe('AlphaGate decision gate', () => {
  it('rejects a valid signal when feed is simulated', () => {
    const decision = evaluateDecisionGate({
      signalResult: validSignal(),
      marketDataAssessment: simulatedAssessment(),
      candidate
    });

    assert.equal(decision.tradeable, false);
    assert.equal(decision.state, 'REJECTED');
    assert.equal(decision.reason, 'MARKET_DATA_SIMULATED');
  });

  it('rejects wrong-symbol signal against candidate', () => {
    const decision = evaluateDecisionGate({
      signalResult: validSignal('WDS'),
      marketDataAssessment: liveAssessment(),
      candidate
    });

    assert.equal(decision.tradeable, false);
    assert.equal(decision.reason, 'WRONG_SYMBOL');
  });

  it('rejects candidate below score threshold', () => {
    const decision = evaluateDecisionGate({
      signalResult: validSignal(),
      marketDataAssessment: liveAssessment(),
      candidate: { ticker: 'CBA', score: 72 }
    });

    assert.equal(decision.tradeable, false);
    assert.equal(decision.reason, 'SIGNAL_THRESHOLD_NOT_MET');
  });

  it('rejects risk failure', () => {
    const decision = evaluateDecisionGate({
      signalResult: validSignal(),
      marketDataAssessment: liveAssessment(),
      candidate,
      riskApproval: { allowed: false, reason: 'DAILY_LOSS_LIMIT' }
    });

    assert.equal(decision.tradeable, false);
    assert.equal(decision.reason, 'DAILY_LOSS_LIMIT');
  });

  it('accepts a valid signal with live market data and risk approval', () => {
    const decision = evaluateDecisionGate({
      signalResult: validSignal(),
      marketDataAssessment: liveAssessment(),
      candidate,
      riskApproval: { allowed: true }
    });

    assert.equal(decision.tradeable, true);
    assert.equal(decision.state, 'PAPER_ELIGIBLE');
  });
});
