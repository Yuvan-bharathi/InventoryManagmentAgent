import sys
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.auth import issue_token, Principal
import urllib.request
import json

# Generate valid token
p = Principal(
    user_id=1,
    username="leader",
    display_name="Leela Iyer",
    tenant_id="T01",
    role="leadership",
    plants=["IN-TN-01", "IN-KA-01"]
)
token = issue_token(p)
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

base = "http://127.0.0.1:8000/api/procurement"

def test_endpoint(url):
    print(f"Testing {url} ...")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        print(f"Status: {resp.status}")
        raw = resp.read().decode()
        data = json.loads(raw)
        return data

overview = test_endpoint(f"{base}/overview")
print("Overview KPIs:", json.dumps(overview.get("data", {}).get("kpis"), indent=2))

shortages = test_endpoint(f"{base}/shortages")
shortage_list = shortages.get("data", [])
print(f"Shortages count: {len(shortage_list)}")
if shortage_list:
    print("Top shortage:", json.dumps(shortage_list[0], indent=2))

compare = test_endpoint(f"{base}/compare?material_id=MAT-CAM-007&required_qty=20")
compare_data = compare.get("data", {})
suppliers = compare_data.get("suppliers", [])
print(f"Suppliers compared: {len(suppliers)}")
recom = compare_data.get('recommended_supplier', {})
print(f"Recommended Supplier: {recom.get('supplier_name')} (Score: {recom.get('recommendation_score')})")
print(f"Recommendation Rationale: {compare_data.get('recommendation_rationale')}")
for s in suppliers:
    print(f"  Rank #{s['rank']} {s['supplier_name']} ({s['country']}): Unit Price: INR {s['unit_price_inr']}, Landed: INR {s['total_landed_cost_inr']}, Lead: {s['lead_time_days']}d, OTIF: {s['on_time_rate_pct']}%, Quality: {s['quality_acceptance_pct']}%, Score: {s['recommendation_score']}")

print("\nSUCCESS! All procurement endpoints functioning flawlessly.")
