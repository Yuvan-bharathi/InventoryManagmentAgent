"""API routes exposing the Model Context Protocol (MCP) servers and tools.
Enables cross-agent communication and frontend/external client tool execution over MCP.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import Principal, current_user
from app.api.common import ctx_dep, RunCtx
from app.agent.tools import ToolCtx
from app.db import get_sessionmaker
from app.mcp import mcp_client

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


class MCPCallRequest(BaseModel):
    name: str = Field(description="Name of the MCP tool to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Arguments for the tool")
    server_id: Optional[str] = Field(default=None, description="Optional target MCP server")


@router.get("/servers")
def list_mcp_servers(user: Principal = Depends(current_user)):
    """List all registered MCP servers."""
    return {"servers": mcp_client.list_servers()}


@router.get("/tools")
def list_all_mcp_tools(server_id: Optional[str] = None, user: Principal = Depends(current_user)):
    """List tools registered across MCP servers with their input schemas (MCP tools/list)."""
    tools = mcp_client.list_tools(server_id=server_id)
    return {
        "count": len(tools),
        "tools": [t.model_dump() for t in tools],
    }


@router.post("/call")
def call_mcp_tool(
    req: MCPCallRequest,
    user: Principal = Depends(current_user),
    ctx: RunCtx = Depends(ctx_dep),
):
    """Execute an MCP tool over the protocol layer (MCP tools/call)."""
    Session = get_sessionmaker()
    with Session() as session:
        t_ctx = ToolCtx(user=user, ctx=ctx, s=session)
        try:
            res = mcp_client.call_tool(req.name, req.arguments, context=t_ctx)
            return {
                "tool": req.name,
                "status": "success",
                "data": res.data,
                "assumptions": sorted(res.assumption_ids),
                "scenario": res.scenario,
                "cites": res.cites,
            }
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal error executing MCP tool: {str(e)}")
