"""
Synthetic data generator for the Agent 09 Inventory Intelligence Engine (ML forecasting).
Builds an internally consistent supply-chain history on top of the organization's real masters
(materials, products, BOM, plants, suppliers, prices, lead times). Fixed seed: same output every run.
Tenant: ML-DEMO (load separately from ORG-01 so the real data is never mixed with synthetic data).
"""
import numpy as np, pandas as pd, os, json
from datetime import date, timedelta

SEED = 20261031
rng = np.random.default_rng(SEED)
SRC = os.environ.get('ORG_DATA', '/home/claude/data/data')
OUT = os.environ.get('OUT_DIR', '/home/claude/mlgen/out')
HIST_START, AS_OF, FUT_END = date(2025, 5, 1), date(2026, 10, 31), date(2027, 1, 29)
TENANT = 'ML-DEMO'
os.makedirs(OUT, exist_ok=True); os.makedirs(f'{OUT}/holdout', exist_ok=True)

mat = pd.read_csv(f'{SRC}/dim_material.csv')
sup = pd.read_csv(f'{SRC}/dim_supplier.csv').set_index('supplier_id')
prod = pd.read_csv(f'{SRC}/dim_product.csv')
bom = pd.read_csv(f'{SRC}/fact_bom_component.csv')
PLANTS = ['IN-TN-01', 'IN-KA-01']
PRODUCTS = list(prod.product_id)

# ---------- extra synthetic material: solder wire (the user's boxes-of-coils example) ----------
mat = pd.concat([mat, pd.DataFrame([{ 'material_id': 'MAT-WIRE-019', 'material_name': 'Solder Wire SAC305 0.8mm', 'material_category': 'CONSUMABLE',
  'uom': 'KG', 'standard_price_inr': 5400, 'lead_time_days': 21, 'safety_stock_qty': 0, 'moq': 0, 'shelf_life_days': 730, 'approved_vendor_required': True }])], ignore_index=True)
mat['source'] = np.where(mat.material_id == 'MAT-WIRE-019', 'SYNTHETIC', 'ORGANIZATION')
M = mat.set_index('material_id')
MATS = list(mat.material_id)

# ---------- packaging conversions (purchase pack -> inner pack -> base unit) ----------
PACK = {  # material: (purchase_uom, inner_uom, inners_per_purchase, base_per_inner)
 'MAT-SOC-001': ('TRAY','TRAY',1,100), 'MAT-MEM-002': ('REEL','REEL',1,2000), 'MAT-NAND-003': ('REEL','REEL',1,1000), 'MAT-PCB-004': ('BOX','PANEL',10,5),
 'MAT-DSP-005': ('BOX','BOX',1,40), 'MAT-BAT-006': ('CARTON','CARTON',1,50), 'MAT-CAM-007': ('TRAY','TRAY',1,100), 'MAT-CAM-008': ('TRAY','TRAY',1,200),
 'MAT-HSG-009': ('CARTON','CARTON',1,60), 'MAT-GLS-010': ('CARTON','CARTON',1,100), 'MAT-SPK-011': ('TRAY','TRAY',1,500), 'MAT-ANT-012': ('BAG','BAG',1,1000),
 'MAT-CON-013': ('REEL','REEL',1,5000), 'MAT-BOX-014': ('BUNDLE','BUNDLE',1,100), 'MAT-CBL-015': ('CARTON','CARTON',1,200), 'MAT-SCR-016': ('BOX','BOX',1,1000),
 'MAT-PASTE-017': ('CASE','JAR',10,0.5), 'MAT-ADH-018': ('CARTON','SYRINGE',20,0.03), 'MAT-WIRE-019': ('BOX','COIL',10,0.1)}
pack_rows = [{'material_id': m, 'purchase_uom': p[0], 'inner_uom': p[1], 'inners_per_purchase': p[2], 'base_qty_per_inner': p[3],
  'base_uom': M.loc[m,'uom'], 'base_qty_per_purchase': round(p[2]*p[3], 6), 'effective_from': '2025-01-01', 'source_type': 'SYNTHETIC'} for m, p in PACK.items()]
pack_df = pd.DataFrame(pack_rows); PACK_BASE = dict(zip(pack_df.material_id, pack_df.base_qty_per_purchase))

# ---------- process parameters (standard qty per finished unit and standard loss) ----------
pp = []
for p in PRODUCTS:
    for m in MATS:
        b = bom[(bom.product_id == p) & (bom.material_id == m)]
        if len(b):
            pp.append({'product_id': p, 'material_id': m, 'std_qty_per_unit': float(b.component_qty.iloc[0]), 'uom': M.loc[m,'uom'], 'std_loss_pct': float(b.scrap_factor.iloc[0]),
                       'source_type': 'ORGANIZATION_BOM', 'assumption_id': None, 'approval_status': 'FROM_ORGANIZATION'})
    paste = 0.0006 if p == 'SPH-PRO-256' else 0.0005
    pp += [{'product_id': p, 'material_id': 'MAT-PASTE-017', 'std_qty_per_unit': paste, 'uom': 'KG', 'std_loss_pct': 0.08, 'source_type': 'TEMPORARY_ASSUMPTION', 'assumption_id': 'A22', 'approval_status': 'AWAITING_CONFIRMATION'},
           {'product_id': p, 'material_id': 'MAT-ADH-018', 'std_qty_per_unit': 0.0003, 'uom': 'KG', 'std_loss_pct': 0.05, 'source_type': 'TEMPORARY_ASSUMPTION', 'assumption_id': 'A23', 'approval_status': 'AWAITING_CONFIRMATION'},
           {'product_id': p, 'material_id': 'MAT-WIRE-019', 'std_qty_per_unit': 0.0002, 'uom': 'KG', 'std_loss_pct': 0.10, 'source_type': 'SYNTHETIC', 'assumption_id': 'A25', 'approval_status': 'SYNTHETIC'}]
pp_df = pd.DataFrame(pp)
STD = {(r.product_id, r.material_id): (r.std_qty_per_unit, r.std_loss_pct) for r in pp_df.itertuples()}

# ---------- supplier assignment (A24: Audio and Connector have no category supplier in the master) ----------
SUPPLIER = {'MAT-SOC-001': 'SUP-001', 'MAT-MEM-002': 'SUP-002', 'MAT-NAND-003': 'SUP-002', 'MAT-PCB-004': 'SUP-003', 'MAT-DSP-005': 'SUP-004', 'MAT-BAT-006': 'SUP-005',
 'MAT-CAM-007': 'SUP-006', 'MAT-CAM-008': 'SUP-006', 'MAT-HSG-009': 'SUP-007', 'MAT-GLS-010': 'SUP-007', 'MAT-SPK-011': 'SUP-009', 'MAT-ANT-012': 'SUP-009',
 'MAT-CON-013': 'SUP-009', 'MAT-BOX-014': 'SUP-008', 'MAT-CBL-015': 'SUP-008', 'MAT-SCR-016': 'SUP-007', 'MAT-PASTE-017': 'SUP-010', 'MAT-ADH-018': 'SUP-010', 'MAT-WIRE-019': 'SUP-010'}
SECONDARY = {'MAT-NAND-003': ('SUP-001', 0.3)}
TIER = {'LOW': (1.0, 1.5, 0.10, 0.002, 0.005), 'MEDIUM': (3.0, 3.5, 0.20, 0.005, 0.015), 'HIGH': (5.0, 5.0, 0.35, 0.012, 0.03)}  # base delay, sd, partial prob, defect rate, lot-reject prob

# ---------- production plan ----------
SEASON = {1: .85, 2: .85, 3: 1.0, 4: 1.0, 5: .95, 6: 1.0, 7: 1.0, 8: 1.15, 9: 1.25, 10: 1.25, 11: 1.05, 12: .95}
BASE = {'IN-TN-01': 360, 'IN-KA-01': 300}
MIX = {'IN-TN-01': [.5, .3, .2], 'IN-KA-01': [.4, .35, .25]}
days = [HIST_START + timedelta(i) for i in range((FUT_END - HIST_START).days + 1)]
def months_since(d): return (d.year - HIST_START.year) * 12 + d.month - HIST_START.month
plan = {}
for pl in PLANTS:
    for d in days:
        working = d.weekday() != 6
        tot = BASE[pl] * SEASON[d.month] * (1 + 0.004 * months_since(d)) if working else 0
        for p, s in zip(PRODUCTS, MIX[pl]): plan[(pl, d, p)] = int(round(tot * s))

def demand_rate(pl, d0, m, n=28):
    tot = 0.0
    for k in range(n):
        dd = d0 + timedelta(k)
        for p in PRODUCTS:
            if (p, m) in STD: q, l = STD[(p, m)]; tot += plan.get((pl, dd, p), 0) * q * (1 + l)
    return tot / n

# ---------- delay model (planted, documented in the data card) ----------
def delay_days(s_id, promised, qty_packs, m, pl='IN-TN-01'):
    s = sup.loc[s_id]; base, sd, *_ = TIER[s.risk_tier]
    dly = base + rng.normal(0, sd)
    md = (promised.month, promised.day)
    if s.country == 'China' and ((promised.month == 1 and promised.day >= 20) or promised.month == 2): dly += 12      # Lunar New Year
    if s.country == 'Vietnam' and ((promised.month == 1 and promised.day >= 20) or (promised.month == 2 and promised.day <= 20)): dly += 6
    if s.country == 'India' and promised.month in (7, 8, 9): dly += 3                                                  # monsoon
    if s.country in ('Taiwan', 'Japan', 'South Korea') and promised.month in (8, 9): dly += 2                          # typhoon season
    size_ratio = qty_packs * PACK_BASE[m] / max(1e-9, demand_ref[m] * 14)
    dly += 1.5 * np.log2(max(1.0, size_ratio))                                                                          # bigger orders ship later
    if s.country != 'India' and pl == 'IN-KA-01': dly += 2                                                             # inland plant: imports clear at Chennai port first
    mo = (promised.year - 2026) * 12 + promised.month - 1
    if s_id == 'SUP-008' and promised.year == 2026: dly += 0.6 * promised.month                                        # packaging supplier deteriorating through 2026
    if s_id == 'SUP-005': dly += -0.3 * max(0, (promised.year - 2025) * 12 + promised.month - 5)                       # battery supplier improving
    if s.country == 'India' and promised.month in (3, 6, 9, 12) and promised.day >= 24: dly += 2                       # quarter-end dispatch backlog
    if s_id == 'SUP-008' and date(2026, 3, 1) <= promised <= date(2026, 4, 30): dly += 6                               # packaging supplier capacity issue
    if rng.random() < 0.04: dly += rng.integers(10, 21)                                                                # rare disruption
    return int(max(-3, round(dly)))

demand_ref = {m: max(1e-9, sum(demand_rate(pl, HIST_START, m) for pl in PLANTS) / 2) for m in MATS}

# ---------- state ----------
onhand = {(pl, m): demand_rate(pl, HIST_START, m) * 60 for pl in PLANTS for m in MATS}
qchold = {(pl, m): 0.0 for pl in PLANTS for m in MATS}
blocked = {(pl, m): 0.0 for pl in PLANTS for m in MATS}
onorder = {(pl, m): 0.0 for pl in PLANTS for m in MATS}
shipments, iqc_due, returns_due = {}, {}, {}
po_open = {}   # po_id -> dict(plant, material, remaining, shipments_left)
po_lines, receipts, iqc_rows, issues, prod_rows, snaps, counts = [], [], [], [], [], [], []
seq = {'po': 0, 'gr': 0, 'iqc': 0, 'lot': 0}

def price(m, d):
    p = M.loc[m, 'standard_price_inr'] * (1 + rng.normal(0, 0.02))
    if m in ('MAT-MEM-002', 'MAT-NAND-003') and d >= date(2026, 3, 1): p *= 1.08          # memory price increase
    return round(float(p), 2)

def actual_loss(pl, m, d, std_loss):
    if m == 'MAT-PASTE-017':
        base = 0.12 if (pl == 'IN-KA-01' and d >= date(2026, 6, 1)) else 0.08                # planted scrap drift
        return max(0.0, rng.normal(base, 0.012))
    if m == 'MAT-WIRE-019': return max(0.0, rng.normal(0.10, 0.015))
    if m == 'MAT-ADH-018': return max(0.0, rng.normal(0.05, 0.008))
    return max(0.0, std_loss + rng.normal(0, 0.002))

def rejected_qty(m, qty, rate, lot_reject):
    """Sample inspection (125 pieces, or 13 inner packs for bulk). Lot screened 100% only if the sample finds defects."""
    if lot_reject: return qty, 125, 0
    if M.loc[m, 'uom'] == 'KG':
        n = max(1, int(round(qty / PACK[m][3]))); smp = min(n, 13)
        found = rng.binomial(smp, rate * 3)
        return (qty * rng.binomial(n, rate * 3) / n if found else 0.0), smp, found
    n = int(round(qty)); smp = min(n, 125)
    found = rng.binomial(smp, rate)
    return (float(rng.binomial(n, rate)) if found else 0.0), smp, found

for d in days:
    for pl in PLANTS:
        # 1 receipts arrive -> QC hold
        for sh in [x for x in shipments.get(d, []) if x['plant'] == pl]:
            seq['gr'] += 1; seq['lot'] += 1
            m, qty = sh['material'], sh['qty']
            rid, lot = f"GR-{seq['gr']:06d}", f"LOT-{seq['lot']:06d}"
            sl = int(M.loc[m, 'shelf_life_days'])
            receipts.append({'tenant_id': TENANT, 'receipt_id': rid, 'po_id': sh['po_id'], 'po_line': 1, 'shipment_seq': sh['seq'], 'supplier_id': sh['supplier'], 'plant_id': pl,
                             'material_id': m, 'receipt_date': d.isoformat(), 'packs_received': round(qty / PACK_BASE[m], 3), 'pack_uom': PACK[m][0], 'received_qty': round(qty, 4),
                             'uom': M.loc[m, 'uom'], 'lot_id': lot, 'expiry_date': (d + timedelta(sl)).isoformat() if sl > 0 else None})
            qchold[(pl, m)] += qty
            po = po_open[sh['po_id']]; po['shipments_left'] -= 1
            take = min(qty, po['remaining']); po['remaining'] -= take; onorder[(pl, m)] -= take
            if po['shipments_left'] == 0 and po['remaining'] > 0:                                # short-closed: balance never comes
                onorder[(pl, m)] -= po['remaining']; po['remaining'] = 0.0
            iqc_due.setdefault(d + timedelta(int(rng.integers(1, 4))), []).append({'rid': rid, 'pl': pl, 'm': m, 'qty': qty, 'lot': lot, 'sup': sh['supplier'], 'rdate': d})
        # 2 incoming QC completes
        for it in [x for x in iqc_due.get(d, []) if x['pl'] == pl]:
            tier = sup.loc[it['sup']].risk_tier; rate, lot_p = TIER[tier][3], TIER[tier][4]
            if it['sup'] == 'SUP-008' and date(2026, 3, 1) <= it['rdate'] <= date(2026, 4, 30): rate *= 4      # print defects period
            lot_reject = rng.random() < lot_p
            rej, smp, found = rejected_qty(it['m'], it['qty'], rate, lot_reject); rej = min(it['qty'], rej); acc = it['qty'] - rej
            seq['iqc'] += 1
            iqc_rows.append({'tenant_id': TENANT, 'iqc_id': f"IQC-{seq['iqc']:06d}", 'receipt_id': it['rid'], 'lot_id': it['lot'], 'plant_id': pl, 'material_id': it['m'],
                             'supplier_id': it['sup'], 'inspection_date': d.isoformat(), 'qc_hold_days': (d - it['rdate']).days, 'received_qty': round(it['qty'], 4),
                             'sample_size': int(smp), 'sample_defects': int(found), 'accepted_qty': round(acc, 4), 'rejected_qty': round(rej, 4),
                             'result': 'REJECT' if lot_reject else ('ACCEPT_WITH_DEFECTS' if rej > 0 else 'ACCEPT'),
                             'disposition': 'RETURN_TO_SUPPLIER' if rej > 0 else 'RELEASE',
                             'defect_code': str(rng.choice(['DIM-OOS', 'COSMETIC', 'ELEC-FAIL', 'PRINT-DEFECT', 'PKG-DAMAGE'])) if rej > 0 else None})
            qchold[(pl, it['m'])] -= it['qty']; onhand[(pl, it['m'])] += acc; blocked[(pl, it['m'])] += rej
            if rej > 0: returns_due.setdefault(d + timedelta(7), []).append((pl, it['m'], rej))
        for (rpl, rm, rq) in [x for x in returns_due.get(d, []) if x[0] == pl]: blocked[(rpl, rm)] = max(0.0, blocked[(rpl, rm)] - rq)
        # 3 production, limited by usable stock
        planned = {p: plan[(pl, d, p)] for p in PRODUCTS}
        if sum(planned.values()) > 0:
            losses = {m: actual_loss(pl, m, d, STD[(PRODUCTS[0], m)][1]) for m in MATS}
            attain = float(np.clip(rng.normal(0.975, 0.02), 0.9, 1.0))
            target = {p: planned[p] * attain for p in PRODUCTS}
            need = {m: sum(target[p] * STD[(p, m)][0] * (1 + losses[m]) for p in PRODUCTS) for m in MATS}
            ratios = {m: onhand[(pl, m)] / need[m] for m in MATS if need[m] > 0}
            scale = min(1.0, min(ratios.values())); limiting = min(ratios, key=ratios.get) if scale < 1 else None
            good = {p: int(np.floor(target[p] * scale)) for p in PRODUCTS}
            built = sum(good.values())
            for m in MATS:
                std_q = sum(good[p] * STD[(p, m)][0] * (1 + STD[(p, m)][1]) for p in PRODUCTS)
                act_q = min(sum(good[p] * STD[(p, m)][0] * (1 + losses[m]) for p in PRODUCTS), onhand[(pl, m)])
                if act_q > 0:
                    onhand[(pl, m)] -= act_q
                    issues.append({'tenant_id': TENANT, 'issue_date': d.isoformat(), 'plant_id': pl, 'material_id': m, 'good_units_built': built,
                                   'standard_qty': round(std_q, 5), 'issued_qty': round(act_q, 5), 'uom': M.loc[m, 'uom'], 'variance_qty': round(act_q - std_q, 5)})
            for p in PRODUCTS:
                lost = int(round(target[p] * (1 - scale))) if scale < 1 else 0
                prod_rows.append({'tenant_id': TENANT, 'production_date': d.isoformat(), 'plant_id': pl, 'product_id': p, 'planned_qty': planned[p], 'good_qty': good[p],
                                  'lost_to_material_qty': lost, 'limiting_material_id': limiting if lost > 0 else None})
        # 4 weekly reorder review (Mondays)
        if d.weekday() == 0:
            for m in MATS:
                rate = demand_rate(pl, d, m); lt = int(M.loc[m, 'lead_time_days'])
                buf = {'LOW': 6, 'MEDIUM': 10, 'HIGH': 16}[sup.loc[SUPPLIER[m]].risk_tier]
                ss = rate * (max(7, 0.5 * lt) + buf); rop = rate * (lt + 7 + 3) + ss; target_pos = rop + rate * 14   # 3 = incoming QC hold
                pos = onhand[(pl, m)] + qchold[(pl, m)] + onorder[(pl, m)]
                if rate > 0 and pos < rop:
                    s_id = SUPPLIER[m]
                    if m in SECONDARY and rng.random() < SECONDARY[m][1]: s_id = SECONDARY[m][0]
                    packs = max(int(np.ceil((target_pos - pos) / PACK_BASE[m])), 2)
                    qty = packs * PACK_BASE[m]; seq['po'] += 1; po_id = f"PO-{seq['po']:06d}"; promised = d + timedelta(lt)
                    tier = sup.loc[s_id].risk_tier
                    fill = 1.0 if rng.random() > (0.15 if tier == 'HIGH' else 0.05) else float(rng.uniform(0.95, 0.99))
                    arrive = promised + timedelta(delay_days(s_id, promised, packs, m, pl))
                    parts = [(1.0, arrive)]
                    if rng.random() < TIER[tier][2]:
                        f1 = float(rng.uniform(0.4, 0.8)); parts = [(f1, arrive), (1 - f1, arrive + timedelta(int(rng.integers(5, 16))))]
                    for k, (frac, ad) in enumerate(parts):
                        q = qty * fill * frac
                        q = round(q, 4) if M.loc[m, 'uom'] == 'KG' else float(np.floor(q))
                        shipments.setdefault(ad, []).append({'po_id': po_id, 'plant': pl, 'material': m, 'supplier': s_id, 'qty': q, 'seq': k + 1})
                    po_open[po_id] = {'remaining': qty, 'shipments_left': len(parts)}; onorder[(pl, m)] += qty
                    po_lines.append({'tenant_id': TENANT, 'po_id': po_id, 'po_line': 1, 'supplier_id': s_id, 'plant_id': pl, 'material_id': m, 'po_date': d.isoformat(),
                                     'promised_date': promised.isoformat(), 'promised_lead_time_days': lt, 'ordered_packs': packs, 'pack_uom': PACK[m][0],
                                     'ordered_qty': round(qty, 4), 'uom': M.loc[m, 'uom'], 'unit_price_inr': price(m, d)})
        # 5 cycle counts (Fridays, 3 materials)
        if d.weekday() == 4:
            for m in rng.choice(MATS, 3, replace=False):
                sysq = onhand[(pl, m)]; err = rng.normal(0, 0.004) + (float(rng.choice([-1, 1])) * rng.uniform(0.03, 0.08) if rng.random() < 0.05 else 0)
                counts.append({'tenant_id': TENANT, 'count_date': d.isoformat(), 'plant_id': pl, 'material_id': str(m), 'system_qty': round(sysq, 4),
                               'counted_qty': round(max(0.0, sysq * (1 + err)), 4), 'uom': M.loc[m, 'uom']})
        # 6 daily stock snapshot
        for m in MATS:
            snaps.append({'tenant_id': TENANT, 'snapshot_date': d.isoformat(), 'plant_id': pl, 'material_id': m, 'usable_qty': round(onhand[(pl, m)], 4),
                          'qc_hold_qty': round(qchold[(pl, m)], 4), 'blocked_qty': round(blocked[(pl, m)], 4),
                          'on_hand_qty': round(onhand[(pl, m)] + qchold[(pl, m)] + blocked[(pl, m)], 4), 'on_order_qty': round(max(0.0, onorder[(pl, m)]), 4),
                          'uom': M.loc[m, 'uom'], 'unit_cost_inr': float(M.loc[m, 'standard_price_inr'])})

# ---------- split: history (load into the app) vs holdout (truth after the as-of date, for scoring forecasts) ----------
AS = AS_OF.isoformat()
def split(rows, col):
    df = pd.DataFrame(rows); return df[df[col] <= AS], df[df[col] > AS]
po = pd.DataFrame(po_lines); rc = pd.DataFrame(receipts); iq = pd.DataFrame(iqc_rows)
hist = {
 'fact_po_line.csv': po[po.po_date <= AS],
 'fact_goods_receipt.csv': rc[rc.receipt_date <= AS],
 'fact_incoming_inspection.csv': iq[iq.inspection_date <= AS],
 'fact_material_issue.csv': split(issues, 'issue_date')[0],
 'fact_inventory_daily.csv': split(snaps, 'snapshot_date')[0],
 'fact_cycle_count.csv': split(counts, 'count_date')[0],
}
pr = pd.DataFrame(prod_rows)
hist['fact_production_daily.csv'] = pr[pr.production_date <= AS]
fut_plan = pr[pr.production_date > AS][['tenant_id', 'production_date', 'plant_id', 'product_id', 'planned_qty']]
hist['fact_production_plan_future.csv'] = fut_plan
hold = {
 'holdout_goods_receipt.csv': rc[(rc.receipt_date > AS) & (rc.po_id.isin(po[po.po_date <= AS].po_id))],
 'holdout_incoming_inspection.csv': iq[iq.inspection_date > AS],
 'holdout_production_daily.csv': pr[pr.production_date > AS],
 'holdout_material_issue.csv': split(issues, 'issue_date')[1],
 'holdout_inventory_daily.csv': split(snaps, 'snapshot_date')[1],
}
masters = {'dim_material_extended.csv': mat, 'material_packaging_conversions.csv': pack_df, 'bom_process_parameters.csv': pp_df,
           'supplier_material_assignment.csv': pd.DataFrame([{'material_id': m, 'supplier_id': s, 'share': 1 - SECONDARY.get(m, (None, 0))[1], 'source_type': 'SYNTHETIC_A24' if m in ('MAT-SPK-011', 'MAT-CON-013') else 'SYNTHETIC'} for m, s in SUPPLIER.items()]
                                                              + [{'material_id': m, 'supplier_id': v[0], 'share': v[1], 'source_type': 'SYNTHETIC'} for m, v in SECONDARY.items()])}
for k, v in {**masters, **hist}.items(): v.to_csv(f'{OUT}/{k}', index=False)
for k, v in hold.items(): v.to_csv(f'{OUT}/holdout/{k}', index=False)
print({k: len(v) for k, v in {**masters, **hist, **hold}.items()})
