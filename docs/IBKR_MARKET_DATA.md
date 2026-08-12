# IBKR Market Data Integration

AlphaGate uses Interactive Brokers as the preferred verified market-data route for the next development phase.

## Important boundary

IBKR is market-data only at this phase.

- IBKR live order execution remains disabled.
- AlphaGate must not place live broker orders.
- TradingView remains a signal/chart input, not an order instruction.
- No verified IBKR market data means no paper eligibility.

## API route

The first adapter targets the Interactive Brokers Client Portal Web API through Client Portal Gateway.

Expected local gateway base URL:

```text
https://localhost:5000/v1/api
```

This gateway runs on the machine/session authenticated with IBKR. A cloud Netlify deployment cannot read a founder laptop's localhost gateway directly. Production use will require either:

1. a local AlphaGate bridge running beside IBKR Gateway/TWS, or
2. a secure hosted/private gateway architecture approved later.

## Required environment variables

```text
ALPHAGATE_IBKR_MARKET_DATA=true
IBKR_CLIENT_PORTAL_BASE_URL=https://localhost:5000/v1/api
IBKR_ACCOUNT_ID=<paper account id when needed later>
```

The code fails closed unless explicitly enabled.

## Implemented endpoint

```text
GET /.netlify/functions/ibkr-market-data?conid=<IBKR_CONID>&symbol=CBA&currency=AUD
```

The endpoint reports:

- IBKR readiness
- session state
- market-data assessment
- live execution disabled

## Current status

The adapter and tests are implemented. A real IBKR session, market-data subscription, contract identifiers and runtime bridge are still required before AlphaGate can label IBKR data as LIVE.
