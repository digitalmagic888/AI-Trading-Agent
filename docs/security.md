# Security

Hard rules:

- No private keys in source.
- No wallet passwords in source.
- No API credentials in source.
- No HMAC values in source.
- No Codex MCP config in the repo.
- No `.twak` directory in the repo.
- No mainnet execution by default.

The repo includes a redaction utility and tests for secret-looking keys and bearer strings. `.gitignore` blocks common credential, wallet, local database, and runtime artifact paths.

Before committing, run the scan from the operating prompt and inspect any matches. Matches in `.gitignore`, docs, or placeholder examples are not real credentials, but any actual value must be removed before push.
