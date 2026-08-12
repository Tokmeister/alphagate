import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEmergencyStop,
  createInitialScannerState,
  emergencyStop,
  runScan,
  startScanner,
  stopScanner
} from '../src/scanner-runtime.js';

const now = Date.parse('2026-08-12T07:00:00.000Z');

test('scanner starts and schedules automatic scan timing', () => {
  const initial = createInitialScannerState(now);
  const started = startScanner(initial, now);

  assert.equal(started.state, 'RUNNING');
  assert.equal(started.nextScanAt, new Date(now).toISOString());
});

test('scanner records last scan and next scan after a run', () => {
  const started = startScanner(createInitialScannerState(now), now);
  const scanned = runScan(
    started,
    { state: 'SIMULATED', tradable: false, reason: 'SIMULATED_FEED_NOT_TRADEABLE' },
    [{ ticker: 'CBA', score: 84 }, { ticker: 'STO', score: 76 }],
    now
  );

  assert.equal(scanned.state, 'BLOCKED');
  assert.equal(scanned.tradingBlocked, true);
  assert.equal(scanned.lastScanAt, new Date(now).toISOString());
  assert.equal(scanned.nextScanAt, new Date(now + scanned.scanIntervalMs).toISOString());
  assert.equal(scanned.qualifiedCount, 1);
});

test('stop scanner blocks trading and removes next scan', () => {
  const stopped = stopScanner(startScanner(createInitialScannerState(now), now), now);

  assert.equal(stopped.state, 'IDLE');
  assert.equal(stopped.tradingBlocked, true);
  assert.equal(stopped.nextScanAt, null);
});

test('emergency stop blocks scanner until cleared', () => {
  const stopped = emergencyStop(createInitialScannerState(now), now);
  assert.equal(stopped.state, 'EMERGENCY_STOPPED');
  assert.equal(stopped.tradingBlocked, true);
  assert.equal(stopped.emergencyStop, true);

  const cleared = clearEmergencyStop(stopped, now);
  assert.equal(cleared.state, 'IDLE');
  assert.equal(cleared.emergencyStop, false);
});
