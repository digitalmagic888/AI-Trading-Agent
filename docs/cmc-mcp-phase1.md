# CMC MCP Phase 1

This file documents the manual Phase 1 gate. It is intentionally not an MCP config file.

1. Rotate the CMC key if it was ever pasted into chat or logs.
2. Set it locally where Codex runs:

```bash
export CMC_MCP_API_KEY="<rotated-value>"
```

3. Merge only this server into local `~/.codex/config.toml`:

```toml
[mcp_servers.cmc-skill-hub]
url = "https://mcp.coinmarketcap.com/skill-hub/stream"
tool_timeout_sec = 300
startup_timeout_sec = 20

[mcp_servers.cmc-skill-hub.http_headers]
X-CMC-MCP-API-KEY = "<value-from-local-env>"
```

4. Restart or reload Codex.
5. Verify `codex mcp get cmc-skill-hub`.
6. Verify native `find_skill(query="btc price")`.
7. If available, verify `execute_skill(unique_name="btc_cross_asset_correlation", parameters={"preview": true})`.

Do not commit local Codex config or credentials.
