import { evaluatePaperEligibility } from './paper-gate.js';

export const DECISION_STATES = Object.freeze({
  PAPER_ELIGIBLE: 'PAPER_ELIGIBLE',
  REJECTED: 'REJECTED',
  WATCH: 'WATCH',
  EXIT_ONLY: 'EXIT_ONLY'
});

export function evaluateDecisionGate({
  signalResult,
  marketDataAssessment,
  candidate,
  riskApproval = { allowed: true },
  minScore = 80
} = {}) {
  if (!signalResult?.accepted) {
    return reject(signalResult?.reason ?? 'SIGNAL_REJECTED');
  }

  const signal = signalResult.signal;
  if (signal.action === 'HOLD') {
    return {
      state: DECISION_STATES.WATCH,
      tradeable: false,
      reason: 'HOLD_SIGNAL_OBSERVED',
      signal,
      candidate
    };
  }

  if (signal.action === 'EXIT') {
    return {
      state: DECISION_STATES.EXIT_ONLY,
      tradeable: false,
      reason: 'EXIT_SIGNAL_REQUIRES_POSITION_MATCH',
      signal,
      candidate
    };
  }

  if (candidate?.ticker && candidate.ticker !== signal.symbol) {
    return reject('WRONG_SYMBOL', signal, candidate);
  }

  if (!candidate || Number(candidate.score) < minScore) {
    return reject('SIGNAL_THRESHOLD_NOT_MET', signal, candidate);
  }

  const paperEligibility = evaluatePaperEligibility({
    signalValid: true,
    marketDataAssessment,
    riskApproval
  });

  if (!paperEligibility.allowed) {
    return reject(paperEligibility.reason, signal, candidate);
  }

  return {
    state: DECISION_STATES.PAPER_ELIGIBLE,
    tradeable: true,
    reason: null,
    signal,
    candidate,
    paperEligibility
  };
}

function reject(reason, signal = null, candidate = null) {
  return {
    state: DECISION_STATES.REJECTED,
    tradeable: false,
    reason,
    signal,
    candidate
  };
}
