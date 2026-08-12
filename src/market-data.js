export const FEED_STATES = Object.freeze({
  LIVE: 'LIVE',
  STALE: 'STALE',
  SIMULATED: 'SIMULATED',
  DISCONNECTED: 'DISCONNECTED'
});

export function assessMarketData({
  source,
  symbol,
  currency,
  price,
  timestamp,
  marketOpen = false,
  simulated = false,
  now = Date.now(),
  maxAgeMs = 10_000
} = {}) {
  if (!source || !symbol || !currency) {
    return block(FEED_STATES.DISCONNECTED, 'MISSING_SOURCE_SYMBOL_OR_CURRENCY');
  }

  if (!Number.isFinite(price) || price <= 0) {
    return block(FEED_STATES.DISCONNECTED, 'INVALID_PRICE');
  }

  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) {
    return block(FEED_STATES.DISCONNECTED, 'INVALID_TIMESTAMP');
  }

  const ageMs = Math.max(0, now - time);

  if (!marketOpen) {
    return {
      state: simulated ? FEED_STATES.SIMULATED : FEED_STATES.STALE,
      tradable: false,
      reason: 'MARKET_CLOSED',
      ageMs
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      state: FEED_STATES.STALE,
      tradable: false,
      reason: 'DATA_STALE',
      ageMs
    };
  }

  if (simulated) {
    return {
      state: FEED_STATES.SIMULATED,
      tradable: false,
      reason: 'SIMULATED_FEED_NOT_TRADEABLE',
      ageMs
    };
  }

  return {
    state: FEED_STATES.LIVE,
    tradable: true,
    reason: 'DATA_LIVE',
    ageMs
  };
}

function block(state, reason) {
  return {
    state,
    tradable: false,
    reason,
    ageMs: null
  };
}
