# AlphaGate IBKR Local Bridge

The IBKR paper session runs locally on the machine where Client Portal Gateway, IB Gateway, or TWS is authenticated. Netlify cannot call that local `localhost` session directly.

This bridge is the safe local process that sits beside IBKR and exposes only sanitized market-data snapshots to AlphaGate.

## Safety boundary

- Market data only.
- No order placement.
- No live broker execution.
- `liveExecutionEnabled` is always `false`.
- If IBKR is offline, unauthenticated, delayed, malformed, or missing a quote, AlphaGate must fail closed.

## Start command

```bash
npm run bridge:ibkr
```

Default bridge URL:

```text
http://127.0.0.1:8787
```

Default IBKR Client Portal URL:

```text
https://localhost:5000/v1/api
```

## Health check

```bash
curl http://127.0.0.1:8787/health
```

## Snapshot check

```bash
curl "http://127.0.0.1:8787/snapshot?conid=<IBKR_CONID>&symbol=CBA&currency=AUD"
```

## Environment variables

```text
IBKR_CLIENT_PORTAL_BASE_URL=https://localhost:5000/v1/api
ALPHAGATE_BRIDGE_HOST=127.0.0.1
ALPHAGATE_BRIDGE_PORT=8787
IBKR_ACCOUNT_ID=<paper-account-id-if-needed>
```

Do not put IBKR passwords, two-factor codes, or live-account credentials in AlphaGate.
