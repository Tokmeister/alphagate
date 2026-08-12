#!/usr/bin/env node

import http from 'node:http';
import { URL } from 'node:url';
import { fetchIbkrSnapshot, createIbkrConfig, checkIbkrSession } from '../src/ibkr-client-portal.js';

const PORT = Number(process.env.ALPHAGATE_BRIDGE_PORT ?? 8787);
const HOST = process.env.ALPHAGATE_BRIDGE_HOST ?? '127.0.0.1';
const IBKR_BASE_URL = process.env.IBKR_CLIENT_PORTAL_BASE_URL ?? 'https://localhost:5000/v1/api';

const config = createIbkrConfig({
  ALPHAGATE_IBKR_MARKET_DATA: 'true',
  IBKR_CLIENT_PORTAL_BASE_URL: IBKR_BASE_URL,
  IBKR_ACCOUNT_ID: process.env.IBKR_ACCOUNT_ID ?? ''
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, null);
    }

    if (req.method !== 'GET') {
      return sendJson(res, 405, {
        error: 'METHOD_NOT_ALLOWED',
        allowed: ['GET']
      });
    }

    if (url.pathname === '/health') {
      const ibkr = await checkIbkrSession({ config, fetchImpl: fetch });
      return sendJson(res, 200, {
        service: 'AlphaGate IBKR Local Bridge',
        mode: 'market-data-only',
        liveExecutionEnabled: false,
        ibkr
      });
    }

    if (url.pathname === '/snapshot') {
      const conid = url.searchParams.get('conid');
      const symbol = url.searchParams.get('symbol');
      const currency = url.searchParams.get('currency') ?? 'AUD';

      if (!conid || !symbol) {
        return sendJson(res, 400, {
          error: 'CONID_AND_SYMBOL_REQUIRED',
          example: '/snapshot?conid=123456&symbol=CBA&currency=AUD'
        });
      }

      const snapshot = await fetchIbkrSnapshot({
        conid,
        symbol,
        currency,
        config,
        fetchImpl: fetch,
        now: Date.now()
      });

      return sendJson(res, 200, {
        provider: 'Interactive Brokers',
        bridge: 'local',
        mode: 'market-data-only',
        liveExecutionEnabled: false,
        ...snapshot
      });
    }

    return sendJson(res, 404, {
      error: 'NOT_FOUND',
      endpoints: ['/health', '/snapshot?conid=<id>&symbol=<ticker>&currency=AUD']
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: 'BRIDGE_ERROR',
      message: error.message,
      liveExecutionEnabled: false
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AlphaGate IBKR Local Bridge listening on http://${HOST}:${PORT}`);
  console.log(`IBKR Client Portal base URL: ${IBKR_BASE_URL}`);
  console.log('Mode: market-data-only. Live execution disabled.');
});

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://localhost:8888',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'x-alphagate-live-execution': 'disabled'
  });

  if (status === 204) return res.end();
  return res.end(JSON.stringify(payload, null, 2));
}
