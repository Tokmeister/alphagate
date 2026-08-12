import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRvol,
  calculateSessionVwap,
  calculateTimeOfDayRvol,
  calculateVwapDistance,
  calculateVwapSlope,
  classifyRvol,
  enrichCandidateWithVwapRvol,
  typicalPrice
} from '../src/vwap-rvol.js';

const bars = [
  { high: 101, low: 99, close: 100, volume: 1000 },
  { high: 102, low: 100, close: 101, volume: 1500 },
  { high: 103, low: 101, close: 102, volume: 2000 },
  { high: 104, low: 102, close: 103, volume: 2500 }
];

test('calculates typical price using HLC3', () => {
  assert.equal(typicalPrice({ high: 105, low: 99, close: 102 }), 102);
});

test('calculates session VWAP from HLC3 and volume', () => {
  const result = calculateSessionVwap(bars);
  assert.equal(result.cumulativeVolume, 7000);
  assert.ok(result.vwap > 101);
  assert.ok(result.vwap < 103);
});

test('classifies VWAP distance', () => {
  assert.equal(calculateVwapDistance(100.2, 100).classification, 'NEAR_VWAP');
  assert.equal(calculateVwapDistance(100.5, 100).classification, 'HEALTHY_EXTENSION');
  assert.equal(calculateVwapDistance(101, 100).classification, 'EXTENDED');
  assert.equal(calculateVwapDistance(102, 100).classification, 'OVEREXTENDED');
});

test('calculates RVOL-20 without look-ahead current volume', () => {
  const prior = Array.from({ length: 20 }, () => 1000);
  const result = calculateRvol(2000, prior, 20);
  assert.equal(result.rvol, 2);
  assert.equal(result.classification, 'STRONG');
});

test('returns insufficient history for RVOL if baseline unavailable', () => {
  const result = calculateRvol(2000, [1000, 900], 20);
  assert.equal(result.rvol, null);
  assert.equal(result.classification, 'INSUFFICIENT_HISTORY');
});

test('calculates time-of-day RVOL from matching slot history', () => {
  const result = calculateTimeOfDayRvol(1800, [900, 1000, 1100]);
  assert.equal(result.rvol, 1.8);
  assert.equal(result.classification, 'MEANINGFUL');
});

test('classifies RVOL bands', () => {
  assert.equal(classifyRvol(0.7), 'WEAK');
  assert.equal(classifyRvol(1.2), 'NORMAL');
  assert.equal(classifyRvol(1.5), 'MEANINGFUL');
  assert.equal(classifyRvol(2), 'STRONG');
  assert.equal(classifyRvol(3), 'EXCEPTIONAL');
});

test('enriches candidate with VWAP and RVOL fields', () => {
  const enriched = enrichCandidateWithVwapRvol(
    { ticker: 'CBA', score: 84 },
    bars,
    Array.from({ length: 20 }, () => 1000),
    [900, 1000, 1100]
  );

  assert.equal(enriched.ticker, 'CBA');
  assert.equal(enriched.price, 103);
  assert.ok(enriched.vwap);
  assert.ok(['UP', 'FLAT', 'DOWN'].includes(enriched.vwapSlope));
  assert.equal(enriched.rvol20, 2.5);
  assert.equal(enriched.rvol20Class, 'STRONG');
  assert.equal(enriched.todRvolClass, 'STRONG');
});

test('calculates VWAP slope without throwing on valid bars', () => {
  assert.ok(['UP', 'FLAT', 'DOWN'].includes(calculateVwapSlope(bars, 3)));
});
