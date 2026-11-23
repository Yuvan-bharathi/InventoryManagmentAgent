"""Direct unit test of simulate_receipt_capacity with custom inners_per_pack."""
import sys
from pathlib import Path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.db import get_sessionmaker
from app.intelligence.capacity import simulate_receipt_capacity

def run_test():
    s = get_sessionmaker()()
    try:
        # 1. 20 boxes solder wire with default 10 coils
        res_default = simulate_receipt_capacity(
            s,
            tenant_id="default-tenant",
            plant_id="IN-KA-01",
            product_id="SPH-A15-128",
            material_id="MAT-WIRE-019",
            pack_quantity=20.0,
            pack_type="BOX",
            inners_per_pack=None,
        )
        print("Default (10 coils):")
        print("  alone capacity:", res_default["capacity_from_receipt_alone"])
        print("  inner breakdown:", res_default["receipt_input"]["inner_breakdown"])
        print("  base qty:", res_default["receipt_input"]["base_quantity"], res_default["receipt_input"]["base_uom"])
        assert res_default["capacity_from_receipt_alone"] == 90909
        assert res_default["receipt_input"]["base_quantity"] == 20.0

        # 2. 20 boxes solder wire with user's example: 8 solder wires per box
        res_8 = simulate_receipt_capacity(
            s,
            tenant_id="default-tenant",
            plant_id="IN-KA-01",
            product_id="SPH-A15-128",
            material_id="MAT-WIRE-019",
            pack_quantity=20.0,
            pack_type="BOX",
            inners_per_pack=8.0,
        )
        print("\nCustom (8 coils per box):")
        print("  alone capacity:", res_8["capacity_from_receipt_alone"])
        print("  inner breakdown:", res_8["receipt_input"]["inner_breakdown"])
        print("  base qty:", res_8["receipt_input"]["base_quantity"], res_8["receipt_input"]["base_uom"])
        assert res_8["capacity_from_receipt_alone"] == 72727
        assert res_8["receipt_input"]["base_quantity"] == 16.0
        assert "20 × 8 COIL" in res_8["receipt_input"]["inner_breakdown"]

        # 3. 20 boxes solder wire with 12 solder wires per box
        res_12 = simulate_receipt_capacity(
            s,
            tenant_id="default-tenant",
            plant_id="IN-KA-01",
            product_id="SPH-A15-128",
            material_id="MAT-WIRE-019",
            pack_quantity=20.0,
            pack_type="BOX",
            inners_per_pack=12.0,
        )
        print("\nCustom (12 coils per box):")
        print("  alone capacity:", res_12["capacity_from_receipt_alone"])
        print("  inner breakdown:", res_12["receipt_input"]["inner_breakdown"])
        print("  base qty:", res_12["receipt_input"]["base_quantity"], res_12["receipt_input"]["base_uom"])
        assert res_12["capacity_from_receipt_alone"] == 109090
        assert res_12["receipt_input"]["base_quantity"] == 24.0

        # 4. 10 boxes Main PCB with 8 panels/box instead of 10
        res_pcb_8 = simulate_receipt_capacity(
            s,
            tenant_id="default-tenant",
            plant_id="IN-KA-01",
            product_id="SPH-A15-128",
            material_id="MAT-PCB-004",
            pack_quantity=10.0,
            pack_type="BOX",
            inners_per_pack=8.0,
        )
        print("\nCustom PCB (8 panels per box):")
        print("  alone capacity:", res_pcb_8["capacity_from_receipt_alone"])
        print("  inner breakdown:", res_pcb_8["receipt_input"]["inner_breakdown"])
        print("  base qty:", res_pcb_8["receipt_input"]["base_quantity"], res_pcb_8["receipt_input"]["base_uom"])
        print("  effective added to plant:", res_pcb_8["effective_capacity_added_to_plant"])
        assert res_pcb_8["receipt_input"]["base_quantity"] == 400.0  # 10 boxes * 8 panels * 5 boards = 400

        print("\n>>> ALL DIRECT UNIT TESTS PASSED! <<<")
    finally:
        s.close()

if __name__ == "__main__":
    run_test()
