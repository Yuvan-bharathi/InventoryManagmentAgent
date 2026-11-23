"""Checks the synthetic dataset: reconciliation, planted patterns, and whether delivery delay is learnable (rolling backtest)."""
import sys, os, pandas as pd, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from delay_features import build, FEATS
from sklearn.linear_model import Ridge
D = os.environ.get('OUT_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')); ORG = os.environ.get('ORG_DATA', '/home/claude/data/data')
po = pd.read_csv(f'{D}/fact_po_line.csv', parse_dates=['po_date', 'promised_date']); rc = pd.read_csv(f'{D}/fact_goods_receipt.csv', parse_dates=['receipt_date'])
iq = pd.read_csv(f'{D}/fact_incoming_inspection.csv'); iss = pd.read_csv(f'{D}/fact_material_issue.csv'); inv = pd.read_csv(f'{D}/fact_inventory_daily.csv')
pr = pd.read_csv(f'{D}/fact_production_daily.csv'); sup = pd.read_csv(f'{ORG}/dim_supplier.csv')
inv = inv.sort_values('snapshot_date'); inv['prev'] = inv.groupby(['plant_id', 'material_id']).usable_qty.shift()
acc = iq.groupby(['inspection_date', 'plant_id', 'material_id']).accepted_qty.sum().rename('acc'); isd = iss.groupby(['issue_date', 'plant_id', 'material_id']).issued_qty.sum().rename('iss')
x = inv.merge(acc, left_on=['snapshot_date', 'plant_id', 'material_id'], right_index=True, how='left').merge(isd, left_on=['snapshot_date', 'plant_id', 'material_id'], right_index=True, how='left').fillna({'acc': 0, 'iss': 0}).dropna(subset=['prev'])
print('1. Stock reconciles with receipts and issues: max error', round((x.prev + x.acc - x.iss - x.usable_qty).abs().max(), 4))
t = pr.groupby('plant_id')[['planned_qty', 'good_qty']].sum(); print('2. Plan attainment %', (t.good_qty / t.planned_qty * 100).round(1).to_dict())
f = build(po, rc, sup)
print('3. Lunar New Year: SUP-001 mean delay Feb vs rest', round(f[(f.supplier_id == 'SUP-001') & (f.promised_date.dt.month == 2)].delay.mean(), 1), round(f[(f.supplier_id == 'SUP-001') & (f.promised_date.dt.month != 2)].delay.mean(), 1))
print('4. Imports: Bengaluru vs Chennai mean delay', round(f[(f.country != 'India') & (f.plant_id == 'IN-KA-01')].delay.mean(), 1), round(f[(f.country != 'India') & (f.plant_id == 'IN-TN-01')].delay.mean(), 1))
p = iss[iss.material_id == 'MAT-PASTE-017'].copy(); p['r'] = p.issued_qty / p.standard_qty
print('5. Solder paste actual/standard at Bengaluru before vs after Jun-2026', round(p[(p.plant_id == 'IN-KA-01') & (p.issue_date < '2026-06-01')].r.mean(), 3), round(p[(p.plant_id == 'IN-KA-01') & (p.issue_date >= '2026-06-01')].r.mean(), 3))
f = pd.concat([f, pd.get_dummies(f.risk_tier, prefix='tier', dtype=int)], axis=1); F = FEATS + [c for c in f if c.startswith('tier_')]
rows = []
for q in (0.55, 0.7, 0.85):
    c0, c1 = f.po_date.quantile(q), f.po_date.quantile(q + 0.15); tr, te = f[f.po_date <= c0], f[(f.po_date > c0) & (f.po_date <= c1)]
    sm = tr.groupby('supplier_id').delay.mean(); rd = Ridge(alpha=1.0).fit(tr[F], tr.delay)
    rows.append((len(tr), len(te), (te.delay - te.supplier_id.map(sm)).abs().mean(), (te.delay - rd.predict(te[F])).abs().mean()))
r = pd.DataFrame(rows, columns=['train', 'test', 'mae_supplier_avg', 'mae_ridge']).round(2)
print('6. Delivery-delay backtest (3 rolling windows)'); print(r.to_string(index=False))
print('   Ridge improvement over supplier average:', round((1 - r.mae_ridge.mean() / r.mae_supplier_avg.mean()) * 100, 1), '%')
