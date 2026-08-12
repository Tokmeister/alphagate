export const SCANNER_STATES = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  BLOCKED: 'BLOCKED',
  EMERGENCY_STOPPED: 'EMERGENCY_STOPPED'
});

export function createInitialScannerState(now = Date.now()) {
  return {
    state: SCANNER_STATES.IDLE,
    scanIntervalMs: 5_000,
    lastScanAt: null,
    nextScanAt: null,
    candidates: [],
    qualifiedCount: 0,
    feedState: 'DISCONNECTED',
    tradingBlocked: true,
    emergencyStop: false,
    updatedAt: new Date(now).toISOString()
  };
}

export function startScanner(state, now = Date.now()) {
  if (state.emergencyStop) {
    return { ...state, state: SCANNER_STATES.EMERGENCY_STOPPED, tradingBlocked: true };
  }

  return {
    ...state,
    state: SCANNER_STATES.RUNNING,
    nextScanAt: new Date(now).toISOString(),
    tradingBlocked: true,
    updatedAt: new Date(now).toISOString()
  };
}

export function stopScanner(state, now = Date.now()) {
  return {
    ...state,
    state: SCANNER_STATES.IDLE,
    nextScanAt: null,
    tradingBlocked: true,
    updatedAt: new Date(now).toISOString()
  };
}

export function emergencyStop(state, now = Date.now()) {
  return {
    ...state,
    state: SCANNER_STATES.EMERGENCY_STOPPED,
    emergencyStop: true,
    nextScanAt: null,
    tradingBlocked: true,
    updatedAt: new Date(now).toISOString()
  };
}

export function clearEmergencyStop(state, now = Date.now()) {
  return {
    ...state,
    state: SCANNER_STATES.IDLE,
    emergencyStop: false,
    tradingBlocked: true,
    updatedAt: new Date(now).toISOString()
  };
}

export function runScan(state, marketDataAssessment, candidates = [], now = Date.now()) {
  if (state.emergencyStop) {
    return emergencyStop(state, now);
  }

  const tradable = marketDataAssessment?.tradable === true;
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  const qualified = ranked.filter((candidate) => candidate.score >= 80);

  return {
    ...state,
    state: tradable ? SCANNER_STATES.RUNNING : SCANNER_STATES.BLOCKED,
    feedState: marketDataAssessment?.state ?? 'DISCONNECTED',
    tradingBlocked: !tradable,
    blockReason: tradable ? null : marketDataAssessment?.reason ?? 'UNKNOWN_BLOCK',
    candidates: ranked,
    qualifiedCount: qualified.length,
    lastScanAt: new Date(now).toISOString(),
    nextScanAt: new Date(now + state.scanIntervalMs).toISOString(),
    updatedAt: new Date(now).toISOString()
  };
}
