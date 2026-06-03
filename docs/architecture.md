# Architecture

TriStack Alpha Agent is organized as a dry-run-first decision pipeline.

```mermaid
sequenceDiagram
  participant CMC as CMC MCP
  participant API as Agent API
  participant Flash as Flash Opportunity Engine
  participant TWAK as Trust Wallet Guard
  participant Ledger as SQLite Ledger
  participant BNB as BNBAgent Service
  participant UI as Dashboard

  API->>CMC: search_cryptos, latest quotes, and global metrics
  CMC-->>API: market context
  API->>Flash: BNB DEX quotes plus Aave premium model
  Flash-->>API: expected profit/loss and route notes
  API->>TWAK: quote-only plan and risk-check command path
  API->>Ledger: redacted decision record
  API->>BNB: manifest/status
  UI->>API: sponsor proof, decisions, audit trail
```

The production shape keeps live chain actions behind explicit environment flags and operator review. The MVP makes every important integration visible without requiring private credentials.
