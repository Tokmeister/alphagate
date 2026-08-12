import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXIT_REASONS,
  POSITION_STATES,
  calculatePositionSize,
  closePaperPosition,
  evaluatePaperPosition,
  openPaperPosition
} from '../src/paper-position.js';

const baseInput = {
  ticker: 'CBA',
  direction: 'LONG',
  entry: 100,
  stop: 98,
  target: 104,
  equity: 10_000,
  riskPercent: 1,
  thesis: 'VWAP reclaim with meaningful RVOL',
  evidenceFor: ['Price above VWAP', 'RVOL > 1.5x'],
  evidenceAgainst: ['Simulated feed only'],
  setup: 'VWAP_RVOL_CONTINUATION',
  marketRegime: 'NEUTRAL',
  openedAt: '2026-08-12T07:00:00.000Z'
};

test('calculates position size from account risk', () => {
  const result = calculatePositionSize({ equity: 10_000, riskPercent: 1, entry: 100, stop: 98 });
  assert.equal(result.maxRisk, 100);
  assert.equal(result.riskPerShare, 2);
  assert.equal(result.quantity, 50);
  assert.equal(result.positionValue, 5000);
});

test('opens a paper position with risk/reward and journal fields', () => {
  const position = openPaperPosition(baseInput);
  assert.equal(position.state, POSITION_STATES.OPEN);
  assert.equal(position.quantity, 50);
  assert.equal(position.maxRisk, 100);
  assert.equal(position.riskReward, 2);
  assert.equal(position.thesis, baseInput.thesis);
});

test('moves open position to HOLD while trade is active', () => {
  const position = openPaperPosition(baseInput);
  const evaluated = evaluatePaperPosition(position, { price: 101, marketDataHealthy: true }, '2026-08-12T07:05:00.000Z');
  assert.equal(evaluated.state, POSITION_STATES.HOLD);
  assert.equal(evaluated.unrealizedPnl, 50);
  assert.equal(evaluated.rMultiple, 0.5);
});

test('moves profitable open position to PROTECT at one R', () => {
  const position = openPaperPosition(baseInput);
  const evaluated = evaluatePaperPosition(position, { price: 102, marketDataHealthy: true }, '2026-08-12T07:05:00.000Z');
  assert.equal(evaluated.state, POSITION_STATES.PROTECT);
  assert.equal(evaluated.rMultiple, 1);
});

test('closes long position at stop loss', () => {
  const position = openPaperPosition(baseInput);
  const closed = evaluatePaperPosition(position, { price: 98, marketDataHealthy: true }, '2026-08-12T07:10:00.000Z');
  assert.equal(closed.state, POSITION_STATES.CLOSED);
  assert.equal(closed.exit.reason, EXIT_REASONS.STOP_LOSS);
  assert.equal(closed.exit.pnl, -100);
  assert.equal(closed.exit.rMultiple, -1);
});

test('closes long position at target', () => {
  const position = openPaperPosition(baseInput);
  const closed = evaluatePaperPosition(position, { price: 104, marketDataHealthy: true }, '2026-08-12T07:10:00.000Z');
  assert.equal(closed.state, POSITION_STATES.CLOSED);
  assert.equal(closed.exit.reason, EXIT_REASONS.TARGET);
  assert.equal(closed.exit.pnl, 200);
  assert.equal(closed.exit.rMultiple, 2);
});

test('closes when market data becomes unhealthy', () => {
  const position = openPaperPosition(baseInput);
  const closed = evaluatePaperPosition(position, { price: 101, marketDataHealthy: false }, '2026-08-12T07:10:00.000Z');
  assert.equal(closed.state, POSITION_STATES.CLOSED);
  assert.equal(closed.exit.reason, EXIT_REASONS.MARKET_DATA_FAILURE);
});

test('closes on manual emergency stop', () => {
  const position = openPaperPosition(baseInput);
  const closed = evaluatePaperPosition(position, { price: 101, emergencyStop: true }, '2026-08-12T07:10:00.000Z');
  assert.equal(closed.exit.reason, EXIT_REASONS.MANUAL_EMERGENCY_STOP);
});

test('supports short position target and stop logic', () => {
  const short = openPaperPosition({ ...baseInput, direction: 'SHORT', entry: 100, stop: 102, target: 96 });
  const targetClosed = evaluatePaperPosition(short, { price: 96, marketDataHealthy: true }, '2026-08-12T07:10:00.000Z');
  assert.equal(targetClosed.exit.reason, EXIT_REASONS.TARGET);
  assert.equal(targetClosed.exit.pnl, 200);

  const short2 = openPaperPosition({ ...baseInput, direction: 'SHORT', entry: 100, stop: 102, target: 96 });
  const stopClosed = evaluatePaperPosition(short2, { price: 102, marketDataHealthy: true }, '2026-08-12T07:10:00.000Z');
  assert.equal(stopClosed.exit.reason, EXIT_REASONS.STOP_LOSS);
  assert.equal(stopClosed.exit.pnl, -100);
});

test('manual close records explicit exit reason', () => {
  const position = openPaperPosition(baseInput);
  const closed = closePaperPosition(position, 101, EXIT_REASONS.SESSION_END, '2026-08-12T07:30:00.000Z');
  assert.equal(closed.state, POSITION_STATES.CLOSED);
  assert.equal(closed.exit.reason, EXIT_REASONS.SESSION_END);
  assert.equal(closed.exit.pnl, 50);
});
