export function typicalPrice(bar) {
  assertFiniteBarNumber(bar?.high, 'high');
  assertFiniteBarNumber(bar?.low, 'low');
  assertFiniteBarNumber(bar?.close, 'close');
  return (bar.high + bar.low + bar.close) / 3;
}

export function calculateSessionVwap(bars = []) {
  if (!Array.isArray(bars) || bars.length === 0) {
    return { vwap: null, cumulativeVolume: 0, cumulativeValue: 0 };
  }

  let cumulativeValue = 0;
  let cumulativeVolume = 0;

  for (const bar of bars) {
    assertFiniteBarNumber(bar.volume, 'volume');
    if (bar.volume < 0) throw new Error('volume must not be negative');
    const price = typicalPrice(bar);
    cumulativeValue += price * bar.volume;
    cumulativeVolume += bar.volume;
  }

  return {
    vwap: cumulativeVolume > 0 ? cumulativeValue / cumulativeVolume : null,
    cumulativeVolume,
    cumulativeValue
  };
}

export function calculateVwapSlope(bars = [], lookback = 3) {
  if (!Array.isArray(bars) || bars.length < Math.max(2, lookback)) return 'FLAT';
  const recent = bars.slice(-lookback);
  const first = calculateSessionVwap(bars.slice(0, bars.length - lookback + 1)).vwap;
  const last = calculateSessionVwap([...bars.slice(0, bars.length - lookback), ...recent]).vwap;

  if (first === null || last === null) return 'FLAT';
  const change = ((last - first) / first) * 100;
  if (change > 0.05) return 'UP';
  if (change < -0.05) return 'DOWN';
  return 'FLAT';
}

export function calculateVwapDistance(price, vwap) {
  assertFiniteBarNumber(price, 'price');
  if (vwap === null || vwap === undefined) {
    return { percent: null, classification: 'UNKNOWN' };
  }
  assertFiniteBarNumber(vwap, 'vwap');
  if (vwap <= 0) throw new Error('vwap must be positive');

  const percent = ((price - vwap) / vwap) * 100;
  const abs = Math.abs(percent);
  let classification = 'NEAR_VWAP';
  if (abs > 1.25) classification = 'OVEREXTENDED';
  else if (abs > 0.75) classification = 'EXTENDED';
  else if (abs > 0.3) classification = 'HEALTHY_EXTENSION';

  return { percent, classification };
}

export function movingAverage(values = [], period = 20) {
  if (!Array.isArray(values)) throw new Error('values must be an array');
  if (!Number.isInteger(period) || period <= 0) throw new Error('period must be a positive integer');
  if (values.length < period) return null;
  const sample = values.slice(-period);
  return sample.reduce((sum, value) => {
    assertFiniteBarNumber(value, 'value');
    return sum + value;
  }, 0) / period;
}

export function calculateRvol(currentVolume, priorVolumes = [], period = 20) {
  assertFiniteBarNumber(currentVolume, 'currentVolume');
  const baseline = movingAverage(priorVolumes, period);
  if (!baseline || baseline <= 0) return { rvol: null, classification: 'INSUFFICIENT_HISTORY' };
  const rvol = currentVolume / baseline;
  return { rvol, classification: classifyRvol(rvol) };
}

export function calculateTimeOfDayRvol(currentVolume, matchingSlotVolumes = []) {
  assertFiniteBarNumber(currentVolume, 'currentVolume');
  if (!Array.isArray(matchingSlotVolumes) || matchingSlotVolumes.length === 0) {
    return { rvol: null, classification: 'INSUFFICIENT_HISTORY' };
  }
  const baseline = matchingSlotVolumes.reduce((sum, value) => {
    assertFiniteBarNumber(value, 'slotVolume');
    return sum + value;
  }, 0) / matchingSlotVolumes.length;

  if (baseline <= 0) return { rvol: null, classification: 'INSUFFICIENT_HISTORY' };
  const rvol = currentVolume / baseline;
  return { rvol, classification: classifyRvol(rvol) };
}

export function classifyRvol(rvol) {
  if (rvol === null || rvol === undefined) return 'INSUFFICIENT_HISTORY';
  assertFiniteBarNumber(rvol, 'rvol');
  if (rvol < 0.8) return 'WEAK';
  if (rvol >= 3) return 'EXCEPTIONAL';
  if (rvol >= 2) return 'STRONG';
  if (rvol >= 1.5) return 'MEANINGFUL';
  return 'NORMAL';
}

export function enrichCandidateWithVwapRvol(candidate, bars, priorVolumes, matchingSlotVolumes, options = {}) {
  if (!candidate?.ticker) throw new Error('candidate ticker is required');
  const latestBar = bars?.at?.(-1);
  if (!latestBar) throw new Error('latest bar is required');

  const session = calculateSessionVwap(bars);
  const distance = calculateVwapDistance(latestBar.close, session.vwap);
  const rvol20 = calculateRvol(latestBar.volume, priorVolumes, options.rvolPeriod ?? 20);
  const todRvol = calculateTimeOfDayRvol(latestBar.volume, matchingSlotVolumes);

  return {
    ...candidate,
    price: latestBar.close,
    vwap: session.vwap,
    vwapSlope: calculateVwapSlope(bars, options.slopeLookback ?? 3),
    vwapDistancePercent: distance.percent,
    vwapDistanceClass: distance.classification,
    rvol20: rvol20.rvol,
    rvol20Class: rvol20.classification,
    todRvol: todRvol.rvol,
    todRvolClass: todRvol.classification
  };
}

function assertFiniteBarNumber(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
}
