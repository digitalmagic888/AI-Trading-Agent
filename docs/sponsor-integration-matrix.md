# Sponsor Integration Matrix

| Sponsor | Required capability | Implemented file(s) | Demo evidence | Status |
| --- | --- | --- | --- | --- |
| CoinMarketCap | CMC MCP market signal layer | `apps/agent/src/cmc/skillHubClient.ts`, `apps/agent/src/cmc/normalizeSignals.ts` | `artifacts/demo-run-latest.json` CMC section | Mock/file mode ready; real mode uses CMC default MCP key |
| Trust Wallet | Wallet, risk, portfolio, quote-only execution guard | `apps/agent/src/trustwallet/twakClient.ts` | TWAK quote-only command in dry-run artifact | Command wrapper ready; real credentials external |
| BNB Chain | Agent identity and BSC venue focus | `services/bnb-agent/*`, `.env.example` | `/agent/manifest`, `/erc8183/status` | Dry-run service ready |
| Aave V3 | Flash liquidity provider | `apps/agent/src/flash/opportunityEngine.ts`, `contracts/contracts/FlashPoolBalancer.sol` | Expected profit/loss and blocked execution gates | Simulation and proof contract ready |
| BNB DEXs | Pool imbalance venues | `apps/agent/src/flash/opportunityEngine.ts` | PancakeSwap/Biswap route in artifact | Mock quote route ready; real quote adapters next |
