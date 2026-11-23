"""Universal Model Context Protocol (MCP) Client.
All agents interact with tools exclusively through this client.
Direct in-process tool calls are replaced by standardized MCP JSON-RPC messages.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.agent.tools import ToolCtx, ToolResult
from app.mcp.models import MCPToolSchema, MCPToolResponse
from app.mcp.inventory_server import InventoryMCPServer
from app.mcp.capacity_server import CapacityMCPServer

logger = logging.getLogger("mcp.client")


class MCPClientRegistry:
    """Central registry and router for Model Context Protocol (MCP) servers."""

    def __init__(self):
        self._servers: Dict[str, Any] = {}
        self._tool_to_server: Dict[str, str] = {}
        # Register core MCP servers
        self.register_server(InventoryMCPServer())
        self.register_server(CapacityMCPServer())

    def register_server(self, server: Any):
        """Register an MCP server."""
        self._servers[server.server_id] = server
        tools = server.list_tools()
        for t in tools:
            self._tool_to_server[t.name] = server.server_id
        logger.info("Registered MCP Server '%s' with %d tools.", server.server_id, len(tools))

    def list_servers(self) -> List[Dict[str, Any]]:
        """List all active MCP servers."""
        return [
            {"server_id": s.server_id, "server_name": s.server_name, "tools_count": len(s.list_tools())}
            for s in self._servers.values()
        ]

    def list_tools(self, server_id: Optional[str] = None) -> List[MCPToolSchema]:
        """Discover tools across all or specific MCP servers (MCP tools/list)."""
        tools = []
        if server_id:
            srv = self._servers.get(server_id)
            return srv.list_tools() if srv else []

        for srv in self._servers.values():
            tools.extend(srv.list_tools())
        return tools

    def call_tool(self, name: str, arguments: Dict[str, Any], context: Optional[ToolCtx] = None) -> ToolResult:
        """Call an MCP tool over the protocol layer (MCP tools/call).

        Returns a standardized ToolResult compatible with the agent execution loop and frontend UI.
        """
        server_id = self._tool_to_server.get(name)
        if not server_id:
            raise ValueError(f"MCP Tool '{name}' not found on any registered MCP server.")

        server = self._servers[server_id]
        response: MCPToolResponse = server.call_tool(name, arguments, context=context)

        if response.status == "error":
            raise ValueError(f"MCP Tool Execution Error [{server_id} -> {name}]: {response.error}")

        # Return standardized ToolResult
        return ToolResult(
            data=response.data,
            assumption_ids=set(response.assumptions),
            scenario=response.scenario,
            cites=response.cites,
        )

    def tool_catalog_str(self, names: Optional[List[str]] = None) -> str:
        """Generate human/LLM-readable tool prompt string from live MCP tool schemas."""
        tools = self.list_tools()
        lines = []
        for t in tools:
            if names is not None and t.name not in names:
                continue
            args_str = ", ".join(t.parameters.keys())
            lines.append(f"- {t.name}({args_str}): [{t.server_id}] {t.description}")
        return "\n".join(lines)


# Singleton MCP Client instance used across backend and agent runtimes
mcp_client = MCPClientRegistry()

