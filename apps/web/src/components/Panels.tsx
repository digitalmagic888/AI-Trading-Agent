import { Activity, BadgeCheck, Brain, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { Metric } from "./Metric";

export function SignalPanel() {
  return (
    <section className="band">
      <div className="section-head"><Brain size={18} /> <h2>Signal Brain</h2></div>
      <div className="grid-3">
        <Metric label="Source" value="CMC Skill Hub" tone="good" />
        <Metric label="Regime" value="Neutral liquidity" />
        <Metric label="Confidence" value="72 / 100" />
      </div>
    </section>
  );
}

export function FlashPanel() {
  return (
    <section className="band">
      <div className="section-head"><Landmark size={18} /> <h2>Flash Opportunity</h2></div>
      <div className="route-row">
        <span>PancakeSwap buy</span><strong>WBNB/USDT</strong><span>Biswap sell</span>
      </div>
      <div className="grid-3">
        <Metric label="Gross spread" value="113.33 bps" tone="good" />
        <Metric label="Cost model" value="58.55 bps + gas" />
        <Metric label="Expected dry-run P/L" value="$51.29" tone="good" />
      </div>
    </section>
  );
}

export function DecisionPanel() {
  return (
    <section className="band">
      <div className="section-head"><Activity size={18} /> <h2>Decision Engine</h2></div>
      <div className="decision-block">
        <strong>EXECUTE_FLASH_ROUTE_BLOCKED</strong>
        <span>Profitable route found in simulation; execution is blocked by default risk gates.</span>
      </div>
      <div className="gate-list">
        <span>CMC confidence pass</span>
        <span>Quote freshness pass</span>
        <span>LIVE_TRADING blocked</span>
        <span>FLASH_LOAN_EXECUTION blocked</span>
        <span>MAX_TRADE_USD blocked</span>
      </div>
    </section>
  );
}

export function WalletPanel() {
  return (
    <section className="band">
      <div className="section-head"><WalletCards size={18} /> <h2>Wallet & Execution Guard</h2></div>
      <div className="grid-3">
        <Metric label="Trust Wallet" value="Quote-only wrapper" />
        <Metric label="Token risk" value="Required before live" tone="warn" />
        <Metric label="Signing" value="Disabled" tone="warn" />
      </div>
    </section>
  );
}

export function IdentityPanel() {
  return (
    <section className="band">
      <div className="section-head"><BadgeCheck size={18} /> <h2>BNB Agent Identity</h2></div>
      <div className="grid-3">
        <Metric label="Network" value="BSC testnet" />
        <Metric label="Manifest" value="Dry-run ready" tone="good" />
        <Metric label="ERC-8183" value="Status endpoint" />
      </div>
    </section>
  );
}

export function SponsorPanel() {
  return (
    <section className="band sponsor-proof">
      <div className="section-head"><ShieldCheck size={18} /> <h2>Sponsor Stack Proof</h2></div>
      <div className="proof-grid">
        <span>CMC = signal intelligence</span>
        <span>Trust Wallet = self-custody guard</span>
        <span>BNBAgent SDK = agent identity</span>
        <span>Aave V3 = flash liquidity model</span>
      </div>
    </section>
  );
}
