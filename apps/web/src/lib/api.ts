export interface SponsorProof {
  cmc: string;
  trustWallet: string;
  bnbAgent: string;
  aave: string;
  mode: string;
  killSwitch: boolean;
}

const agentApiUrl = import.meta.env.VITE_AGENT_API_URL ?? "http://localhost:3001";

export async function fetchSponsorProof(): Promise<SponsorProof> {
  try {
    const response = await fetch(`${agentApiUrl}/api/sponsor-proof`);
    if (!response.ok) throw new Error(`API ${response.status}`);
    return await response.json() as SponsorProof;
  } catch {
    return {
      cmc: "Mock CMC Skill Hub signal is wired; real mode waits for local MCP config.",
      trustWallet: "TWAK quote-only command wrapper is dry-run-safe.",
      bnbAgent: "Manifest service is available in dry-run mode.",
      aave: "Aave V3 flash-loan route simulation is modeled before any contract execution.",
      mode: "dry-run",
      killSwitch: true
    };
  }
}
