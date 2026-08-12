import { assessMarketData } from '../src/market-data.js';
import {
  clearEmergencyStop,
  createInitialScannerState,
  emergencyStop,
  runScan,
  startScanner,
  stopScanner
} from '../src/scanner-runtime.js';

const elements = {
  startScanner: document.querySelector('#startScanner'),
  stopScanner: document.querySelector('#stopScanner'),
  refreshNow: document.querySelector('#refreshNow'),
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
  eventLog: document.querySelector('#eventLog')
};

let scanner = createInitialScannerState();
let timer = null;
const journal = [];

const simulatedCandidates = [
  { ticker: 'CBA', action: 'WATCH', price: 180.4, vwap: 179.8, rvol: 1.82, score: 84, decision: 'WATCH - SIMULATED' },
  { ticker: 'WDS', action: 'WATCH', price: 25.14, vwap: 24.92, rvol: 1.67, score: 82, decision: 'WATCH - SIMULATED' },
  { ticker: 'STO', action: 'WAIT', price: 7.38, vwap: 7.35, rvol: 1.44, score: 76, decision: 'WAIT - VOLUME LOW' }
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

function tick(manual = false) {
  const now = Date.now();
  const assessment = simulatedAssessment(now);
  scanner = runScan(scanner, assessment, simulatedCandidates, now);
  log(manual ? 'Manual refresh completed with simulated feed.' : 'Automatic scan completed with simulated feed.');
  render();
}

function scheduleLoop() {
  clearInterval(timer);
  timer = setInterval(() => tick(false), scanner.scanIntervalMs);
}

function log(message) {
  const item = `${new Date().toLocaleTimeString()} — ${message}`;
  journal.unshift(item);
  if (journal.length > 20) journal.pop();
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
      <td>${candidate.price.toFixed(2)}</td>
      <td>${candidate.vwap.toFixed(2)}</td>
      <td>${candidate.rvol.toFixed(2)}x</td>
      <td>${candidate.score}</td>
      <td>${candidate.decision}</td>
    </tr>
  `).join('');

  elements.eventLog.innerHTML = journal.map((entry) => `<li>${entry}</li>`).join('');
}

elements.startScanner.addEventListener('click', () => {
  scanner = startScanner(scanner);
  log('Scanner started. Automatic simulated scan loop active.');
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

elements.emergencyStop.addEventListener('click', () => {
  clearInterval(timer);
  timer = null;
  scanner = emergencyStop(scanner);
  log('Emergency stop triggered. Trading blocked.');
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
