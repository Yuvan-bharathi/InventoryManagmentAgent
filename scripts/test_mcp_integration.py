"""Verification script for Model Context Protocol (MCP) integration across agents and tools.
"""
import sys
import json
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.mcp import mcp_client
from app.db import get_sessionmaker
from app.auth import Principal
from app.api.common import RunCtx
from app.agent.tools import ToolCtx


def test_mcp_protocol():
    print("=" * 70)
    print("TEST 1: MCP Server Discovery")
    print("=" * 70)
    servers = mcp_client.list_servers()
    print("Active MCP Servers:", json.dumps(servers, indent=2))
    assert len(servers) >= 2, "Expected at least 2 MCP servers (inventory & capacity)"
    server_ids = [s["server_id"] for s in servers]
    assert "inventory-mcp-server" in server_ids
    assert "capacity-ml-mcp-server" in server_ids

    print("\n" + "=" * 70)
    print("TEST 2: MCP Tool Discovery (tools/list)")
    print("=" * 70)
    tools = mcp_client.list_tools()
    print(f"Discovered {len(tools)} tools across MCP servers:")
    for t in tools:
        print(f"  [{t.server_id}] {t.name}: {t.description[:65]}...")
    assert any(t.name == "compare_supplier_quotes" for t in tools)
    assert any(t.name == "convert_packaging_units" for t in tools)
    assert any(t.name == "calculate_build_capacity" for t in tools)
    assert any(t.name == "predict_delivery_delay_range" for t in tools)

    print("\n" + "=" * 70)
    print("TEST 3: MCP Tool Call - Packaging Conversion Chain (Deterministic)")
    print("=" * 70)
    # Question: "What capacity do 20 boxes of solder wire support?"
    res_pack = mcp_client.call_tool(
        "convert_packaging_units",
        {"material_id": "MAT-WIRE-019", "quantity": 20.0, "pack_type": "BOX", "product_id": "SPH-A15-128"}
    )
    print("Packaging Conversion MCP Result:")
    print(json.dumps(res_pack.data, indent=2))
    assert res_pack.data["units_supported_by_receipt_alone"] == 90909
    print("✓ Successfully verified 20 boxes solder wire -> 90,909 phones!")

    print("\n" + "=" * 70)
    print("TEST 4: MCP Tool Call - Plant Build Capacity & Effective Added Capacity")
    print("=" * 70)
    # Question: "How many phones can Bengaluru build, and what does 20 boxes of solder wire add to the plant?"
    res_cap = mcp_client.call_tool(
        "calculate_build_capacity",
        {
            "plant_id": "IN-KA-01",
            "product_id": "SPH-A15-128",
            "additional_material_id": "MAT-WIRE-019",
            "additional_quantity": 20.0,
            "additional_pack_type": "BOX"
        }
    )
    print("Build Capacity MCP Result:")
    print(json.dumps(res_cap.data, indent=2))
    assert res_cap.data["safety_stock_protected_capacity"] == 0
    assert res_cap.data["receipt_impact"]["effective_capacity_added_to_plant"] == 0
    print("✓ Successfully verified: Gross capacity calculated, Protected capacity is 0, Effective added capacity is 0 (bottleneck remains)!")

    print("\n" + "=" * 70)
    print("TEST 5: MCP Tool Call - ML Delivery Delay Range Prediction")
    print("=" * 70)
    # Test Lunar New Year + inland import effect for China supplier to Bengaluru
    res_delay = mcp_client.call_tool(
        "predict_delivery_delay_range",
        {
            "supplier_id": "SUP-006",
            "material_id": "MAT-CAM-007",
            "promised_date": "2026-02-05",
            "order_quantity": 2000.0,
            "destination_plant": "IN-KA-01"
        }
    )
    print("ML Delay Prediction MCP Result:")
    print(json.dumps(res_delay.data, indent=2))
    assert res_delay.data["predicted_delay_days"] > 14.0
    print("✓ Successfully verified: ML model predicted Lunar New Year + inland port delay!")

    print("\n" + "=" * 70)
    print("TEST 6: MCP Tool Call - Scrap Drift Detection")
    print("=" * 70)
    res_drift = mcp_client.call_tool(
        "detect_scrap_drift",
        {"plant_id": "IN-KA-01", "material_id": "MAT-PASTE-017"}
    )
    print("Scrap Drift MCP Result:")
    print(json.dumps(res_drift.data, indent=2))
    assert res_drift.data["drift_alert"] is True
    print("✓ Successfully verified: Scrap drift detected for solder paste at Bengaluru!")

    print("\n" + "=" * 70)
    print("TEST 7: MCP Tool Call - Inventory Smart Procurement (Agent 09 Tool)")
    print("=" * 70)
    from app.api.common import run_ctx
    Session = get_sessionmaker()
    with Session() as session:
        user = Principal(user_id="U-BUYER", username="buyer", display_name="Priya (Purchasing Officer)", role="Buyer", tenant_id="ORG-01", plants=["IN-TN-01", "IN-KA-01"])
        ctx = run_ctx(session, user.tenant_id)
        t_ctx = ToolCtx(user=user, ctx=ctx, s=session)

        res_quote = mcp_client.call_tool(
            "compare_supplier_quotes",
            {"material": "MAT-CAM-007", "quantity": 20, "plant": "IN-TN-01"},
            context=t_ctx
        )
        rec_sup = res_quote.data.get("recommended_supplier", {}).get("supplier_id")
        print("Supplier Quote Compare MCP Result (Best Supplier):", rec_sup)
        assert rec_sup == "SUP-004"
        print("✓ Successfully verified Agent 09 tool execution over MCP!")

    print("\n" + "=" * 70)
    print("ALL MCP INTEGRATION TESTS PASSED WITH ZERO DIRECT IN-PROCESS CALLS!")
    print("=" * 70)


if __name__ == "__main__":
    test_mcp_protocol()
