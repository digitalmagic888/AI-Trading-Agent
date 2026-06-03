# Risk Model

Flash-loan pool balancing is fragile. The MVP treats every opportunity as invalid until it survives explicit gates.

Key risks:

- Stale quotes can turn apparent profit into a loss.
- DEX price impact and fees can erase spread.
- Aave flash-loan premium must be repaid in the same transaction.
- Failed live transactions still consume gas.
- MEV, sandwiching, and priority gas auctions can change execution economics.
- Token risk, allowlists, and wallet state must be checked before execution.
- Mainnet private keys and wallet credentials must never be committed or logged.

Default blockers:

- `LIVE_TRADING=false`
- `FLASH_LOAN_EXECUTION=false`
- `MAX_TRADE_USD=0`
- `MAX_DAILY_NOTIONAL_USD=0`
- `KILL_SWITCH=true`

The dry-run artifact exists so judges can audit the decision without any capital at risk.
