import pandas as pd, numpy as np
def build(po, rc, sup):
    f = rc[rc.shipment_seq == 1].merge(po, on=['po_id', 'supplier_id', 'plant_id', 'material_id']).merge(sup[['supplier_id', 'country', 'risk_tier']], on='supplier_id')
    f['delay'] = (f.receipt_date - f.promised_date).dt.days
    f = f.sort_values('po_date').reset_index(drop=True)
    pm, pdy = f.promised_date.dt.month, f.promised_date.dt.day
    f['import_inland'] = ((f.country != 'India') & (f.plant_id == 'IN-KA-01')).astype(int)
    med = f.groupby('material_id').ordered_qty.transform('median')
    f['size_log'] = np.log2((f.ordered_qty / med).clip(lower=1))
    f['quarter_end_dom'] = ((f.country == 'India') & pm.isin([3, 6, 9, 12]) & (pdy >= 24)).astype(int)
    f['monsoon_dom'] = ((f.country == 'India') & pm.isin([7, 8, 9])).astype(int)
    f['typhoon'] = (f.country.isin(['Taiwan', 'Japan', 'South Korea']) & pm.isin([8, 9])).astype(int)
    f['lunar_ny'] = ((f.country.isin(['China', 'Vietnam'])) & (((pm == 1) & (pdy >= 20)) | (pm == 2))).astype(int)
    f['lt'] = f.promised_lead_time_days
    # supplier's recent record: mean delay of receipts that arrived in the 90 days before this order date (no leakage)
    rec = f[['supplier_id', 'receipt_date', 'delay']].copy()
    vals = []
    for r in f.itertuples():
        h = rec[(rec.supplier_id == r.supplier_id) & (rec.receipt_date < r.po_date) & (rec.receipt_date >= r.po_date - pd.Timedelta(days=90))]
        vals.append(h.delay.mean() if len(h) >= 3 else np.nan)
    f['recent_delay'] = vals
    f['recent_delay'] = f.recent_delay.fillna(f.groupby('supplier_id').recent_delay.transform(lambda s: s.expanding().mean().shift())).fillna(f.delay.expanding().mean().shift()).fillna(3)
    return f
FEATS = ['import_inland', 'size_log', 'quarter_end_dom', 'monsoon_dom', 'typhoon', 'lunar_ny', 'lt', 'recent_delay']
