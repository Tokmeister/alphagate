export const POSITION_STATES = Object.freeze({
  OPEN: 'OPEN',
  HOLD: 'HOLD',
  PROTECT: 'PROTECT',
  CLOSED: 'CLOSED'
});

export const EXIT_REASONS = Object.freeze({
  STOP_LOSS: 'STOP_LOSS',
  TARGET: 'TARGET',
  TRAILING_PROTECTION: 'TRAILING_PROTECTION',
  THESIS_INVALIDATION: 'THESIS_INVALIDATION',
  VWAP_FAILURE: 'VWAP_FAILURE',
  MOMENTUM_REVERSAL: 'MOMENTUM_REVERSAL',
  RISK_BREACH: 'RISK_BREACH',
  MARKET_DATA_FAILURE: 'MARKET_DATA_FAILURE',
  SESSION_END: 'SESSION_END',
  MANUAL_EMERGENCY_STOP: 'MANUAL_EMERGENCY_STOP'
});

export function calculatePositionSize({ equity, riskPercent = 1, entry, stop }) {
  assertPositive(equity, 'equity');
  assertPositive(riskPercent, 'riskPercent');
  assertPositive(entry, 'entry');
  assertPositive(stop, 'stop');

  const riskPerShare = Math.abs(entry - stop);
  if (riskPerShare <= 0) throw new Error('entry and stop cannot be equal');

  const maxRisk = equity * (riskPercent / 100);
  const quantity = Math.floor(maxRisk / riskPerShare);

  return {
    quantity,
    maxRisk,
    riskPerShare,
    positionValue: quantity * entry
  };
}

export function openPaperPosition(input) {
  const {
    ticker,
    direction,
    entry,
    stop,
    target,
    equity = 10_000,
    riskPercent = 1,
    thesis = 'No thesis recorded',
    evidenceFor = [],
    evidenceAgainst = [],
    setup = 'UNCLASSIFIED',
    marketRegime = 'UNKNOWN',
    openedAt = new Date().toISOString()
  } = input ?? {};

  if (!ticker) throw new Error('ticker is required');
  if (!['LONG', 'SHORT'].includes(direction)) throw new Error('direction must be LONG or SHORT');
  assertPositive(entry, 'entry');
  assertPositive(stop, 'stop');
  assertPositive(target, 'target');

  const sizing = calculatePositionSize({ equity, riskPercent, entry, stop });
  if (sizing.quantity <= 0) throw new Error('position size is zero; risk is too small or stop is too wide');

  const rewardPerShare = Math.abs(target - entry);
  const riskReward = rewardPerShare / sizing.riskPerShare;

  return {
    id: `paper-${ticker}-${Date.parse(openedAt) || Date.now()}`,
    ticker,
    direction,
    state: POSITION_STATES.OPEN,
    entry,
    stop,
    target,
    quantity: sizing.quantity,
    maxRisk: sizing.maxRisk,
    riskPerShare: sizing.riskPerShare,
    riskReward,
    thesis,
    evidenceFor,
    evidenceAgainst,
    setup,
    marketRegime,
    openedAt,
    updatedAt: openedAt,
    exit: null,
    unrealizedPnl: 0,
    rMultiple: 0
  };
}

export function evaluatePaperPosition(position, marketSnapshot, now = new Date().toISOString()) {
  if (!position || position.state === POSITION_STATES.CLOSED) return position;

  const price = marketSnapshot?.price;
  assertPositive(price, 'price');

  if (marketSnapshot?.marketDataHealthy === false) {
    return closePaperPosition(position, price, EXIT_REASONS.MARKET_DATA_FAILURE, now);
  }

  if (marketSnapshot?.emergencyStop === true) {
    return closePaperPosition(position, price, EXIT_REASONS.MANUAL_EMERGENCY_STOP, now);
  }

  if (marketSnapshot?.thesisInvalidated === true) {
    return closePaperPosition(position, price, EXIT_REASONS.THESIS_INVALIDATION, now);
  }

  if (marketSnapshot?.sessionEnding === true) {
    return closePaperPosition(position, price, EXIT_REASONS.SESSION_END, now);
  }

  if (position.direction === 'LONG') {
    if (price <= position.stop) return closePaperPosition(position, price, EXIT_REASONS.STOP_LOSS, now);
    if (price >= position.target) return closePaperPosition(position, price, EXIT_REASONS.TARGET, now);
  } else {
    if (price >= position.stop) return closePaperPosition(position, price, EXIT_REASONS.STOP_LOSS, now);
    if (price <= position.target) return closePaperPosition(position, price, EXIT_REASONS.TARGET, now);
  }

  const unrealizedPnl = calculatePnl(position, price);
  const rMultiple = position.maxRisk > 0 ? unrealizedPnl / position.maxRisk : 0;
  const nextState = rMultiple >= 1 ? POSITION_STATES.PROTECT : POSITION_STATES.HOLD;

  return {
    ...position,
    state: nextState,
    unrealizedPnl,
    rMultiple,
    updatedAt: now
  };
}

export function closePaperPosition(position, exitPrice, reason, closedAt = new Date().toISOString()) {
  assertPositive(exitPrice, 'exitPrice');
  if (!Object.values(EXIT_REASONS).includes(reason)) throw new Error('invalid exit reason');

  const pnl = calculatePnl(position, exitPrice);
  const rMultiple = position.maxRisk > 0 ? pnl / position.maxRisk : 0;

  return {
    ...position,
    state: POSITION_STATES.CLOSED,
    updatedAt: closedAt,
    unrealizedPnl: 0,
    rMultiple,
    exit: {
      reason,
      price: exitPrice,
      pnl,
      rMultiple,
      closedAt,
      timeInTradeMs: Math.max(0, Date.parse(closedAt) - Date.parse(position.openedAt))
    }
  };
}

export function calculatePnl(position, price) {
  assertPositive(price, 'price');
  const directionFactor = position.direction === 'LONG' ? 1 : -1;
  return (price - position.entry) * position.quantity * directionFactor;
}

function assertPositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}
