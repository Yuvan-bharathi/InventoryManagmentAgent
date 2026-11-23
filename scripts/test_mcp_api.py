import requests

BASE = "http://127.0.0.1:8000"
# Login
resp = requests.post(f"{BASE}/api/auth/login", json={"username": "buyer", "password": "demo"})
assert resp.status_code == 200, f"Login failed: {resp.text}"
token = resp.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# List MCP servers
r_srv = requests.get(f"{BASE}/api/mcp/servers", headers=headers)
print("MCP Servers from API:", r_srv.json())
assert r_srv.status_code == 200

# List MCP tools
r_tools = requests.get(f"{BASE}/api/mcp/tools", headers=headers)
print(f"MCP Tools count: {r_tools.json()['count']}")
assert r_tools.status_code == 200
assert r_tools.json()["count"] >= 20

# Call MCP tool via REST endpoint
call_payload = {
    "name": "convert_packaging_units",
    "arguments": {
        "material_id": "MAT-WIRE-019",
        "quantity": 20.0,
        "pack_type": "BOX",
        "product_id": "SPH-A15-128"
    }
}
r_call = requests.post(f"{BASE}/api/mcp/call", json=call_payload, headers=headers)
print("MCP Call Response Status:", r_call.status_code)
print("MCP Call Result Data:", r_call.json()["data"])
assert r_call.status_code == 200
assert r_call.json()["data"]["units_supported_by_receipt_alone"] == 90909

print("\n✓ ALL END-TO-END MCP REST/PROTOCOL CHECKS PASSED PERFECTLY!")
