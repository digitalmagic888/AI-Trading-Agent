import type { ReactNode } from "react";

export function Metric({ label, value, tone = "neutral", icon }: { label: string; value: string; tone?: "neutral" | "good" | "warn"; icon?: ReactNode }) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-label">{icon}{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
