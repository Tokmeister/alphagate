import { assessMarketData } from '../src/market-data.js';
import {
  clearEmergencyStop,
  createInitialScannerState,
  emergencyStop,
  runScan,
  startScanner,
  stopScanner
} from '../src/scanner-runtime.js';
import { enrichCandidateWithVwapRvol } from '../src/vwap-rvol.js';
import { evaluatePaperPosition, openPaperPosition } from '../src/paper-position.js';

const elements = {
  startScanner: document.querySelector('#startScanner'),
  stopScanner: document.querySelector('#stopScanner'),
  refreshNow: document.querySelector('#refreshNow'),
  openPaperDemo: document.querySelector('#openPaperDemo'),
  evaluatePositions: document.querySelector('#evaluatePositions'),
  emergencyStop: document.querySelector('#emergencyStop'),
  clearEmergency: document.querySelector('#clearEmergency'),
  exportJournal: document.querySelector('#exportJournal'),
  scannerState: document.querySelector('#scannerState'),
  scannerReason: document.querySelector('#scannerReason'),
  feedState: document.querySelector('#feedState'),
  feedReason: document.querySelector('#feedReason'),
  feedPill: document.querySelector('#feedPill'),
  lastScan: document.querySelector('#lastScan'),
  nextScan: document.querySelector('#nextScan'),
  countdown: document.querySelector('#countdown'),
  tradingStatus: document.querySelector('#tradingStatus'),
  candidateRows: document.querySelector('#candidateRows'),
  positionRows: document.querySelector('#positionRows'),
  openPositions: document.querySelector('#openPositions'),
  unrealizedPnl: document.querySelector('#unrealizedPnl'),
  eventLog: document.querySelector('#eventLog')
};

let scanner = createInitialScannerState();
let timer = null;
let scanSequence = 0;
const journal = [];
const paperPositions = [];

const candidateSeeds = [
  { ticker: 'CBA', action: 'WATCH', score: 84, decision: 'WATCH - SIMULATED VWAP/RVOL', basePrice: 180.4 },
  { ticker: 'WDS', action: 'WATCH', score: 82, decision: 'WATCH - SIMULATED VWAP/RVOL', basePrice: 25.14 },
  { ticker: 'STO', action: 'WAIT', score: 76, decision: 'WAIT - VOLUME LOW', basePrice: 7.38 }
];

function simulatedAssessment(now = Date.now()) {
  return assessMarketData({
    source: 'AlphaGate simulated feed',
    symbol: 'SIM-ASX',
    currency: 'AUD',
    price: 100,
    timestamp: new Date(now).toISOString(),
    marketOpen: true,
    simulated: true,
    now
  });
}

function buildBars(seed, sequence) {
  const drift = Math.sin(sequence / 2) * 0.12;
  return [0, 1, 2, 3, 4].map((step) => {
    const close = seed.basePrice + drift + step * seed.basePrice * 0.001;
    return {
      high: close * 1.002,
      low: close * 0.998,
      close,
      volume: 1000 + step * 180 + seed.score * 8
    };
  });
}

function buildCandidates() {
  scanSequence += 1;
  return candidateSeeds.map((seed) => enrichCandidateWithVwapRvol(
    seed,
    buildBars(seed, scanSequence),
    Array.from({ length: 20 }, (_, index) => 850 + index * 9 + seed.score * 4),
    [900 + seed.score, 960 + seed.score, 1010 + seed.score]
  ));
}

function tick(manual = false) {
  const now = Date.now();
  const assessment = simulatedAssessment(now);
  const candidates = buildCandidates();
  scanner = runScan(scanner, assessment, candidates, now);
  evaluateOpenPositions(false);
  log(manual ? 'Manual refresh completed with simulated VWAP/RVOL scan.' : 'Automatic scan completed with simulated VWAP/RVOL scan.');
  render();
}

function scheduleLoop() {
  clearInterval(timer);
  timer = setInterval(() => tick(false), scanner.scanIntervalMs);
}

function log(message) {
  const item = `${new Date().toLocaleTimeString()} — ${message}`;
  journal.unshift(item);
  if (journal.length > 30) journal.pop();
}

function openDemoPosition() {
  if (scanner.tradingBlocked) {
    log('Paper demo blocked: feed is simulated and not paper-trade eligible. Opening controlled demo position for lifecycle visibility only.');
  }

  const candidate = scanner.candidates[0] ?? buildCandidates()[0];
  const position = openPaperPosition({
    ticker: candidate.ticker,
    direction: 'LONG',
    entry: Number(candidate.price.toFixed(2)),
    stop: Number((candidate.price * 0.99).toFixed(2)),
    target: Number((candidate.price * 1.02).toFixed(2)),
    equity: 10_000,
    riskPercent: 1,
    thesis: 'Simulated lifecycle demo: VWAP/RVOL candidate requires real feed before eligibility.',
    evidenceFor: [`VWAP slope ${candidate.vwapSlope}`, `RVOL-20 ${formatMultiple(candidate.rvol20)}`],
    evidenceAgainst: ['Feed state is SIMULATED', 'TradingView webhook not connected'],
    setup: 'SIMULATED_VWAP_RVOL_DEMO',
    marketRegime: 'SIMULATED'
  });

  paperPositions.unshift(position);
  log(`Opened simulated paper lifecycle demo for ${position.ticker}. Not a live or broker trade.`);
  render();
}

function evaluateOpenPositions(writeLog = true) {
  for (let index = 0; index < paperPositions.length; index += 1) {
    const position = paperPositions[index];
    if (position.state === 'CLOSED') continue;
    const baseMove = Math.sin((scanSequence + index) / 2) * 0.006;
    const price = Number((position.entry * (1 + baseMove)).toFixed(2));
    paperPositions[index] = evaluatePaperPosition(position, {
      price,
      marketDataHealthy: false
    });
  }

  if (writeLog) log('Evaluated paper positions. Simulated/failed data forces protective close by design.');
}

function render() {
  elements.scannerState.textContent = scanner.state;
  elements.scannerReason.textContent = scanner.blockReason ?? (scanner.emergencyStop ? 'Emergency stop active' : 'Operational control ready');
  elements.feedState.textContent = scanner.feedState;
  elements.feedReason.textContent = scanner.blockReason ?? 'Simulated feed blocks trading by design';
  elements.feedPill.textContent = `${scanner.feedState} FEED`;
  elements.feedPill.className = `pill ${scanner.feedState === 'SIMULATED' ? 'warning' : ''}`;
  elements.lastScan.textContent = scanner.lastScanAt ? new Date(scanner.lastScanAt).toLocaleTimeString() : '—';
  elements.nextScan.textContent = scanner.nextScanAt ? new Date(scanner.nextScanAt).toLocaleTimeString() : '—';
  elements.tradingStatus.textContent = scanner.tradingBlocked ? 'TRADING BLOCKED' : 'PAPER ELIGIBLE';
  elements.tradingStatus.className = scanner.tradingBlocked ? 'pill danger' : 'pill success';

  const seconds = scanner.nextScanAt ? Math.max(0, Math.ceil((Date.parse(scanner.nextScanAt) - Date.now()) / 1000)) : null;
  elements.countdown.textContent = seconds === null ? 'Stopped' : `${seconds}s until next scan`;

  elements.candidateRows.innerHTML = scanner.candidates.map((candidate) => `
    <tr>
      <td>${candidate.ticker}</td>
      <td>${candidate.action}</td>
      <td>${formatMoney(candidate.price)}</td>
      <td>${formatMoney(candidate.vwap)}</td>
      <td>${formatPercent(candidate.vwapDistancePercent)} <small>${candidate.vwapDistanceClass}</small></td>
      <td>${candidate.vwapSlope}</td>
      <td>${formatMultiple(candidate.rvol20)} <small>${candidate.rvol20Class}</small></td>
      <td>${formatMultiple(candidate.todRvol)} <small>${candidate.todRvolClass}</small></td>
      <td>${candidate.score}</td>
      <td>${candidate.decision}</td>
    </tr>
  `).join('');

  const active = paperPositions.filter((position) => position.state !== 'CLOSED');
  const unrealized = active.reduce((sum, position) => sum + position.unrealizedPnl, 0);
  elements.openPositions.textContent = active.length;
  elements.unrealizedPnl.textContent = formatMoney(unrealized);

  elements.positionRows.innerHTML = paperPositions.map((position) => `
    <tr>
      <td>${position.ticker}</td>
      <td>${position.state}</td>
      <td>${position.direction}</td>
      <td>${formatMoney(position.entry)}</td>
      <td>${formatMoney(position.stop)}</td>
      <td>${formatMoney(position.target)}</td>
      <td>${position.quantity}</td>
      <td>${position.rMultiple.toFixed(2)}R</td>
      <td>${position.exit?.reason ?? '—'}</td>
    </tr>
  `).join('');

  elements.eventLog.innerHTML = journal.map((entry) => `<li>${entry}</li>`).join('');
}

function formatMoney(value) {
  return Number.isFinite(value) ? `A$${value.toFixed(2)}` : '—';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
}

function formatMultiple(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}x` : '—';
}

elements.startScanner.addEventListener('click', () => {
  scanner = startScanner(scanner);
  log('Scanner started. Automatic simulated VWAP/RVOL scan loop active.');
  tick(false);
  scheduleLoop();
});

elements.stopScanner.addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
  scanner = stopScanner(scanner);
  log('Scanner stopped.');
  render();
});

elements.refreshNow.addEventListener('click', () => tick(true));
elements.openPaperDemo.addEventListener('click', () => openDemoPosition());
elements.evaluatePositions.addEventListener('click', () => {
  evaluateOpenPositions(true);
  render();
});

elements.emergencyStop.addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
  scanner = emergencyStop(scanner);
  evaluateOpenPositions(false);
  log('Emergency stop triggered. Scanner stopped and paper lifecycle closed unsafe positions.');
  render();
});

elements.clearEmergency.addEventListener('click', () => {
  scanner = clearEmergencyStop(scanner);
  log('Emergency stop cleared. Scanner remains idle until started.');
  render();
});

elements.exportJournal.addEventListener('click', () => {
  const payload = journal.join('\n') || 'No AlphaGate events recorded yet.';
  const blob = new Blob([payload], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'alphagate-journal.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  log('Journal export requested.');
  render();
});

log('AlphaGate shell loaded. Feed is SIMULATED and not tradeable.');
render();
setInterval(render, 1000);
