"""Inventory & Smart Procurement MCP Server (Agent 09 Tool Host).
Exposes deterministic inventory analytics, replenishment algorithms, and supplier intelligence
as standard Model Context Protocol (MCP) tools.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List
from pydantic import ValidationError

from app.agent.tools import TOOLS, ToolCtx, ToolResult
from app.mcp.models import MCPToolSchema, MCPToolResponse

logger = logging.getLogger("mcp.inventory_server")
SERVER_ID = "inventory-mcp-server"


class InventoryMCPServer:
    """MCP Server managing Agent 09's inventory & procurement tool suite."""

    def __init__(self):
        self.server_id = SERVER_ID
        self.server_name = "Agent 09 Inventory & Smart Procurement MCP Server"

    def list_tools(self) -> List[MCPToolSchema]:
        """Discover tools exposed by this MCP server (MCP tools/list)."""
        schemas = []
        for name, (_, arg_schema, desc) in TOOLS.items():
            json_schema = arg_schema.model_json_schema()
            schemas.append(
                MCPToolSchema(
                    name=name,
                    title=name.replace("_", " ").title(),
                    description=desc,
                    parameters=json_schema.get("properties", {}),
                    server_id=self.server_id,
                )
            )
        return schemas

    def call_tool(self, name: str, arguments: Dict[str, Any], context: ToolCtx) -> MCPToolResponse:
        """Execute a tool via MCP protocol (MCP tools/call)."""
        if name not in TOOLS:
            return MCPToolResponse(
                tool=name,
                server_id=self.server_id,
                status="error",
                error=f"Tool '{name}' is not registered on {self.server_id}",
            )

        fn, schema, _ = TOOLS[name]
        # Tenant/security boundary: remove any tenant overrides from client arguments
        safe_args = {k: v for k, v in (arguments or {}).items() if k not in ("tenant", "tenant_id")}

        try:
            parsed = schema(**safe_args)
            result: ToolResult = fn(context, parsed)
            return MCPToolResponse(
                tool=name,
                server_id=self.server_id,
                status="success",
                data=result.data,
                assumptions=sorted(result.assumption_ids, key=lambda x: int(x[1:]) if x[1:].isdigit() else 0),
                scenario=result.scenario,
                cites=result.cites,
            )
        except ValidationError as e:
            err_msg = f"Invalid arguments for {name}: {e.errors()[0]['msg']} ({e.errors()[0]['loc']})"
            logger.warning(err_msg)
            return MCPToolResponse(
                tool=name,
                server_id=self.server_id,
                status="error",
                error=err_msg,
            )
        except Exception as e:
            logger.exception("Error executing MCP tool %s: %s", name, str(e))
            return MCPToolResponse(
                tool=name,
                server_id=self.server_id,
                status="error",
                error=str(e),
            )

