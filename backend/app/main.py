"""FastAPI application. Run: uvicorn app.main:app --reload (from backend/)."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import app.services  # noqa: F401  registers post-run hooks
from app.api import routes_data, routes_intelligence, routes_inventory, routes_proposals, routes_mcp, routes_connectors, routes_warehouse, routes_integration
from app.config import REPO_ROOT

app = FastAPI(title="Inventory Management Agent (Agent 09)", version="0.3")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
for r in (routes_data.router, routes_inventory.router, routes_proposals.router, routes_intelligence.router, routes_mcp.router, routes_connectors.router, routes_warehouse.router, routes_integration.router):
    app.include_router(r)

try:
    from app.api import routes_agent
    app.include_router(routes_agent.router)
except ImportError:  # Stage 3
    pass


@app.on_event("startup")
def _warm_caches():
    import threading
    from app.api.common import warm
    threading.Thread(target=warm, daemon=True).start()


@app.get("/api/health")
def health():
    return {"ok": True}


DIST = REPO_ROOT / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if path and f.is_file() else DIST / "index.html")
