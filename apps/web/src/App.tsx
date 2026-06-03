import { useEffect, useState } from "react";
import { AlertTriangle, CircleStop, Play } from "lucide-react";
import { fetchSponsorProof, type SponsorProof } from "./lib/api";
import { DecisionPanel, FlashPanel, IdentityPanel, SignalPanel, SponsorPanel, WalletPanel } from "./components/Panels";

export function App() {
  const [proof, setProof] = useState<SponsorProof | null>(null);

  useEffect(() => {
    fetchSponsorProof().then(setProof).catch(() => undefined);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>TriStack Alpha Agent</h1>
          <p>AI flash-liquidity pool balancing for BNB Chain, dry-run first.</p>
        </div>
        <div className="mode-strip">
          <span><Play size={14} /> {proof?.mode ?? "dry-run"}</span>
          <span><CircleStop size={14} /> Kill switch {proof?.killSwitch ? "on" : "off"}</span>
          <span><AlertTriangle size={14} /> No live signing</span>
        </div>
      </header>
      <SignalPanel />
      <FlashPanel />
      <DecisionPanel />
      <WalletPanel />
      <IdentityPanel />
      <SponsorPanel />
    </main>
  );
}
