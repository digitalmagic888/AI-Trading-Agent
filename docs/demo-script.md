# Demo Script

1. Open the README and explain the thesis: CMC signal, Aave temporary liquidity, Trust Wallet guard, BNBAgent identity.
2. Run `pnpm demo:dry-run`.
3. Open `artifacts/demo-run-latest.json` and show the CMC mock skill, normalized signal, flash-route economics, and blocked execution gates.
4. Start `pnpm agent:run` and `pnpm web:dev`.
5. Show the dashboard sections: Signal Brain, Flash Opportunity, Decision Engine, Wallet & Execution Guard, BNB Agent Identity, Audit Trail, Sponsor Stack Proof.
6. Run `cd services/bnb-agent && python register_agent.py --dry-run` to show the manifest.
7. Explain that no transaction was signed, broadcast, or deployed because default gates block execution.
