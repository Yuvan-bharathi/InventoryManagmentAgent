"""Verify receipt capacity simulation with customizable inner item counts per pack."""
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_custom_inners_per_pack():
    session = requests.Session()
    # Authenticate as Purchasing Officer (Priya)
    auth_resp = session.post(
        f"{BASE_URL}/api/auth/dev-login",
        json={"email": "priya.sharma@example.com"}
    )
    assert auth_resp.status_code == 200, f"Login failed: {auth_resp.text}"

    # 1. Test Solder Wire with default 10 coils/box
    resp_default = session.post(
        f"{BASE_URL}/api/production/simulate-receipt",
        json={
            "plant_id": "IN-KA-01",
            "product_id": "SPH-A15-128",
            "material_id": "MAT-WIRE-019",
            "pack_quantity": 20.0,
            "pack_type": "BOX",
            "inners_per_pack": 10.0,
        }
    )
    assert resp_default.status_code == 200, resp_default.text
    d1 = resp_default.json()["data"]
    print("Default (10 coils/box):", d1["capacity_from_receipt_alone"], "phones. Breakdown:", d1["receipt_input"]["inner_breakdown"])
    assert d1["capacity_from_receipt_alone"] == 90909, f"Expected 90,909, got {d1['capacity_from_receipt_alone']}"

    # 2. Test Solder Wire with custom 8 coils/box (as user specifically requested: 'some times in one box 10 solder wires will be present and some times 8 will be present')
    resp_8 = session.post(
        f"{BASE_URL}/api/production/simulate-receipt",
        json={
            "plant_id": "IN-KA-01",
            "product_id": "SPH-A15-128",
            "material_id": "MAT-WIRE-019",
            "pack_quantity": 20.0,
            "pack_type": "BOX",
            "inners_per_pack": 8.0,
        }
    )
    assert resp_8.status_code == 200, resp_8.text
    d2 = resp_8.json()["data"]
    print("Custom (8 coils/box):", d2["capacity_from_receipt_alone"], "phones. Breakdown:", d2["receipt_input"]["inner_breakdown"])
    assert d2["capacity_from_receipt_alone"] == 72727, f"Expected 72,727, got {d2['capacity_from_receipt_alone']}"
    assert "8 COIL" in d2["receipt_input"]["inner_breakdown"]
    assert d2["receipt_input"]["base_quantity"] == 16.0

    # 3. Test PCB with custom 8 panels/box instead of 10
    resp_pcb = session.post(
        f"{BASE_URL}/api/production/simulate-receipt",
        json={
            "plant_id": "IN-KA-01",
            "product_id": "SPH-A15-128",
            "material_id": "MAT-PCB-004",
            "pack_quantity": 10.0,
            "pack_type": "BOX",
            "inners_per_pack": 8.0,
        }
    )
    assert resp_pcb.status_code == 200, resp_pcb.text
    d3 = resp_pcb.json()["data"]
    print("Custom PCB (8 panels/box):", d3["capacity_from_receipt_alone"], "phones. Breakdown:", d3["receipt_input"]["inner_breakdown"])
    assert d3["receipt_input"]["base_quantity"] == 400.0  # 10 * 8 * 5 = 400

    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_custom_inners_per_pack()

