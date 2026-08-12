# AlphaGate Phase-1 Architecture

## Runtime flow

Market data -> scanner -> TradingView signal/context -> data integrity gate -> AlphaGate research/scoring -> risk gate -> paper execution -> position management -> exit -> evaluation.

## Scanner

The scanner is designed to be event/data driven. Manual refresh is an override only. The normal loop must continuously report feed health, last update, next scan, candidate count and tradeability.

## Data integrity

Every candidate must have a valid symbol, currency, positive price, valid timestamp and fresh data while the market is open. Invalid, stale, disconnected or closed-market data blocks trading.

## TradingView

TradingView webhook alerts are treated as evidence/input. They never directly place orders.

## Execution safety

Phase 1 uses paper execution. IBKR live execution is disabled until shadow-mode validation, paper-broker validation, risk controls and operational reconciliation have passed.
