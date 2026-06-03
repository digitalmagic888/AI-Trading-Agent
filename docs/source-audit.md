# Source Audit

Inspected sources before implementation:

| Source | Purpose | Status |
| --- | --- | --- |
| https://coinmarketcap.com/api/hackathon/ | Hackathon goals, dates, sponsor framing | Available |
| https://coinmarketcap.com/api/agent/ | CMC agent and CMC MCP direction | Available |
| https://coinmarketcap.com/api/mcp/ | CMC MCP context | Available |
| https://developer.trustwallet.com/developer/agent-sdk | Trust Wallet Agent SDK overview | Available |
| https://developer.trustwallet.com/developer/agent-sdk/cli-reference | TWAK CLI direction | Available |
| https://github.com/bnb-chain/bnbagent-sdk | BNBAgent SDK package and examples | Available |
| https://aave.com/help/aave-101/accessing-aave | Aave deployment context including BNB Chain | Available |
| https://raw.githubusercontent.com/aave/aave-v3-core/master/contracts/protocol/pool/Pool.sol | Aave V3 Pool source for flash-loan terminology | Available |

Implementation note: the repo ships mock/file mode plus real CMC default MCP mode. `CMC_MCP_API_KEY` stays outside Git and can be provided either through Codex MCP config or the app process environment.
