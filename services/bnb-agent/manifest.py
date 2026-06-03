from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from typing import Any


@dataclass(frozen=True)
class AgentManifest:
    name: str
    description: str
    service_endpoint: str
    network: str
    repo_url: str
    capabilities: list[str]
    dry_run_default: bool
    live_execution_requires: list[str]


def build_manifest() -> dict[str, Any]:
    manifest = AgentManifest(
        name="TriStack Alpha Agent",
        description="Self-custody CMC-signal BNB trading agent that models Aave flash-loan pool balancing with transparent risk rules.",
        service_endpoint=os.getenv("ERC8183_AGENT_URL", "http://localhost:8003"),
        network=os.getenv("NETWORK", "bsc-testnet"),
        repo_url=os.getenv("REPO_URL", "https://github.com/digitalmagic888/AI-Trading-Agent"),
        capabilities=[
            "market-signal-analysis",
            "flash-liquidity-opportunity-scoring",
            "risk-gated-trade-quote",
            "self-custody-execution-guard",
            "bnb-agent-identity",
        ],
        dry_run_default=True,
        live_execution_requires=[
            "LIVE_TRADING=true",
            "FLASH_LOAN_EXECUTION=true",
            "configured wallet credentials",
            "token and chain allowlists",
            "operator review",
        ],
    )
    return asdict(manifest)
