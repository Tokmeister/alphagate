import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bridgeSource = await readFile(new URL('../local-bridge/ibkr-local-bridge.mjs', import.meta.url), 'utf8');

test('local bridge is market-data only and exposes no order route', () => {
  assert.match(bridgeSource, /market-data-only/);
  assert.match(bridgeSource, /liveExecutionEnabled:\s*false/);
  assert.doesNotMatch(bridgeSource, /placeOrder/i);
  assert.doesNotMatch(bridgeSource, /submitOrder/i);
  assert.doesNotMatch(bridgeSource, /iserver\/account\/.*order/i);
});

test('local bridge exposes only health and snapshot paths', () => {
  assert.match(bridgeSource, /url\.pathname === '\/health'/);
  assert.match(bridgeSource, /url\.pathname === '\/snapshot'/);
  assert.doesNotMatch(bridgeSource, /\/order/);
  assert.doesNotMatch(bridgeSource, /\/trade/);
});

test('local bridge requires conid and symbol for snapshots', () => {
  assert.match(bridgeSource, /CONID_AND_SYMBOL_REQUIRED/);
});
