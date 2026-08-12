export const TRADINGVIEW_ACTIONS = Object.freeze({
  LONG: 'LONG',
  SHORT: 'SHORT',
  HOLD: 'HOLD',
  EXIT: 'EXIT'
});

export const SIGNAL_STATES = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  DUPLICATE: 'DUPLICATE'
});

export function normalizeTradingViewSignal(payload = {}, now = Date.now()) {
  const symbol = String(payload.symbol ?? '').trim().toUpperCase();
  const action = String(payload.action ?? '').trim().toUpperCase();
  const timeframe = String(payload.timeframe ?? '').trim();
  const receivedAt = payload.receivedAt ?? new Date(now).toISOString();
  const price = Number(payload.price);
  const source = payload.source ?? 'TradingView';
  const id = payload.id ?? buildSignalId({ symbol, action, price, timeframe, receivedAt });

  return {
    id,
    source,
    symbol,
    action,
    timeframe,
    price,
    receivedAt,
    raw: payload
  };
}

export function validateTradingViewSignal(signal, now = Date.now(), options = {}) {
  const maxAgeMs = options.maxAgeMs ?? 60_000;
  const allowedActions = new Set(Object.values(TRADINGVIEW_ACTIONS));
  const receivedTime = Date.parse(signal?.receivedAt);

  if (!signal || signal.source !== 'TradingView') {
    return reject('INVALID_SOURCE');
  }

  if (!signal.symbol) {
    return reject('MISSING_SYMBOL');
  }

  if (!allowedActions.has(signal.action)) {
    return reject('INVALID_ACTION');
  }

  if (!Number.isFinite(signal.price) || signal.price <= 0) {
    return reject('INVALID_PRICE');
  }

  if (!Number.isFinite(receivedTime)) {
    return reject('INVALID_TIMESTAMP');
  }

  if (Math.abs(now - receivedTime) > maxAgeMs) {
    return reject('SIGNAL_STALE');
  }

  return {
    state: SIGNAL_STATES.ACCEPTED,
    accepted: true,
    reason: null,
    signal
  };
}

export function detectDuplicateSignal(signal, seenSignals = new Map(), now = Date.now(), ttlMs = 120_000) {
  const key = signal?.id;
  if (!key) return { duplicate: false, key: null };

  const previous = seenSignals.get(key);
  if (previous && now - previous <= ttlMs) {
    return { duplicate: true, key, reason: 'DUPLICATE_SIGNAL' };
  }

  seenSignals.set(key, now);
  for (const [seenKey, seenAt] of seenSignals.entries()) {
    if (now - seenAt > ttlMs) seenSignals.delete(seenKey);
  }

  return { duplicate: false, key };
}

export function ingestTradingViewSignal(payload, context = {}) {
  const now = context.now ?? Date.now();
  const signal = normalizeTradingViewSignal(payload, now);
  const validation = validateTradingViewSignal(signal, now, context.validationOptions);

  if (!validation.accepted) {
    return {
      state: SIGNAL_STATES.REJECTED,
      accepted: false,
      reason: validation.reason,
      signal
    };
  }

  const duplicate = detectDuplicateSignal(signal, context.seenSignals, now, context.duplicateTtlMs);
  if (duplicate.duplicate) {
    return {
      state: SIGNAL_STATES.DUPLICATE,
      accepted: false,
      reason: duplicate.reason,
      signal
    };
  }

  return {
    state: SIGNAL_STATES.ACCEPTED,
    accepted: true,
    reason: null,
    signal
  };
}

export function buildSignalId({ symbol, action, price, timeframe, receivedAt }) {
  return [symbol, action, Number(price).toFixed(4), timeframe, receivedAt].join(':');
}

function reject(reason) {
  return {
    state: SIGNAL_STATES.REJECTED,
    accepted: false,
    reason
  };
}
