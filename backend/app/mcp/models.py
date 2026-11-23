"""Data models and protocol definitions for Model Context Protocol (MCP) tool execution.
Conforms to MCP standard JSON-RPC 2.0 tool discovery and execution.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MCPToolParameter(BaseModel):
    name: str
    type: str = "string"
    description: Optional[str] = None
    required: bool = False
    default: Optional[Any] = None


class MCPToolSchema(BaseModel):
    name: str
    title: Optional[str] = None
    description: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    server_id: str = "inventory-mcp-server"


class MCPCallParams(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class MCPToolResponse(BaseModel):
    tool: str
    server_id: str
    status: str = "success"  # success | error
    data: Any = None
    assumptions: List[str] = Field(default_factory=list)
    scenario: bool = False
    cites: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None

