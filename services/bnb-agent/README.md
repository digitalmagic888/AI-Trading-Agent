# BNB Agent Service

This service exposes the TriStack Alpha Agent manifest and ERC-8183-style status endpoint for the hackathon demo. It defaults to dry-run mode and does not register on chain unless wallet configuration is supplied intentionally.

```bash
cd services/bnb-agent
python -m venv .venv
source .venv/bin/activate
pip install -e .[server]
cp .env.example .env
python register_agent.py --dry-run
uvicorn agent_server:app --port 8003
```
