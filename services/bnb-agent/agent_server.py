from __future__ import annotations

import json
from manifest import build_manifest


async def app(scope, receive, send):
    if scope["type"] != "http":
        return
    path = scope.get("path", "/")
    if path == "/health":
        body = {"ok": True, "service": "tristack-bnb-agent"}
        status = 200
    elif path == "/agent/manifest":
        body = build_manifest()
        status = 200
    elif path == "/erc8183/status":
        body = {"status": "dry-run", "registered": False, "network": build_manifest()["network"], "note": "Registration requires explicit wallet configuration."}
        status = 200
    else:
        body = {"error": "not found"}
        status = 404
    payload = json.dumps(body).encode("utf-8")
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": payload})
