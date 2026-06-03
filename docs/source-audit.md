# Source Audit

Inspected sources before implementation:

| Source | Purpose | Status |
| --- | --- | --- |
| https://coinmarketcap.com/api/hackathon/ | Hackathon goals, dates, sponsor framing | Available |
| https://coinmarketcap.com/api/agent/ | CMC agent and Skill Hub direction | Available |
| https://coinmarketcap.com/api/mcp/ | CMC MCP context | Available |
| https://developer.trustwallet.com/developer/agent-sdk | Trust Wallet Agent SDK overview | Available |
| https://developer.trustwallet.com/developer/agent-sdk/cli-reference | TWAK CLI direction | Available |
| https://github.com/bnb-chain/bnbagent-sdk | BNBAgent SDK package and examples | Available |
| https://aave.com/help/aave-101/accessing-aave | Aave deployment context including BNB Chain | Available |
| https://raw.githubusercontent.com/aave/aave-v3-core/master/contracts/protocol/pool/Pool.sol | Aave V3 Pool source for flash-loan terminology | Available |

Implementation note: the local `cmc-skill-hub` MCP server was not configured because `CMC_MCP_API_KEY` was not present in the local shell. The repo ships mock/file mode plus real-mode instructions instead of hardcoding any credential.
