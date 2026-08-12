export function evaluatePaperEligibility({ signal, marketData, riskApproved = false }) {
  if (!signal || !['LONG', 'SHORT', 'HOLD', 'EXIT'].includes(signal.action)) {
    return reject('INVALID_SIGNAL');
  }

  if (signal.action === 'HOLD' || signal.action === 'EXIT') {
    return reject('NON_ENTRY_SIGNAL');
  }

  if (!marketData?.tradable) {
    return reject(marketData?.reason ?? 'MARKET_DATA_BLOCKED');
  }

  if (!riskApproved) {
    return reject('RISK_REJECTED');
  }

  return {
    eligible: true,
    decision: 'PAPER_ELIGIBLE',
    reason: 'ALL_GATES_PASSED'
  };
}

function reject(reason) {
  return {
    eligible: false,
    decision: 'NO_TRADE',
    reason
  };
}
