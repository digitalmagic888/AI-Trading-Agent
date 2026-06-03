# CMC MCP Setup

This file documents how to connect the project and Codex to CoinMarketCap's official `cmc-mcp` skill. It is intentionally not an MCP config file.

The working endpoint for the current API key type is:

```text
https://mcp.coinmarketcap.com/mcp
```

The CMC skill documentation lists tools such as `search_cryptos`, `get_crypto_quotes_latest`, `get_global_metrics_latest`, `get_crypto_technical_analysis`, `get_global_crypto_derivatives_metrics`, and `trending_crypto_narratives`.

## Codex MCP config

1. Get an API key from https://pro.coinmarketcap.com/login.
2. Configure local Codex where Codex itself runs. Do not commit this file.

```toml
[mcp_servers.cmc-mcp]
url = "https://mcp.coinmarketcap.com/mcp"
tool_timeout_sec = 300
startup_timeout_sec = 20

[mcp_servers.cmc-mcp.http_headers]
X-CMC-MCP-API-KEY = "<your-api-key>"
```

3. Restart or reload Codex.
4. Verify with:

```bash
codex mcp get cmc-mcp
```

5. Use the native CMC MCP tools, starting with `search_cryptos(query="btc", limit=3)` and then `get_crypto_quotes_latest(id="1")`.

## App real mode

For the local app API, keep secrets outside Git and run:

```bash
export CMC_MODE=real
export CMC_MCP_API_KEY="<your-api-key>"
pnpm demo:dry-run
```

The app defaults to `CMC_MODE=mock` so tests and demos work without credentials.
