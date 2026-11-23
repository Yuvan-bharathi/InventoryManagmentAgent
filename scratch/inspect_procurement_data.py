import pandas as pd
from pathlib import Path

DATA_DIR = Path('data/data')

df_quotes = pd.read_csv(DATA_DIR / 'fact_rfq_quote.csv')
df_pos = pd.read_csv(DATA_DIR / 'fact_purchase_order_receipt.csv')
df_supp = pd.read_csv(DATA_DIR / 'dim_supplier.csv')
df_mat = pd.read_csv(DATA_DIR / 'dim_material.csv')

print("--- RFQ QUOTES ---")
print("Total quotes:", len(df_quotes))
print("Materials with quotes:", df_quotes['material_id'].unique().tolist())
print("Suppliers with quotes:", df_quotes['supplier_id'].unique().tolist())
print(df_quotes.head(3))

print("\n--- HISTORICAL POS ---")
print("Total PO lines:", len(df_pos))
print("PO statuses:", df_pos['po_status'].value_counts().to_dict())
print("Incoterms:", df_pos['incoterm'].value_counts().to_dict())
print(df_pos.head(3))

print("\n--- SUPPLIERS ---")
print(df_supp[['supplier_id', 'supplier_name', 'country', 'material_category', 'payment_terms']])

