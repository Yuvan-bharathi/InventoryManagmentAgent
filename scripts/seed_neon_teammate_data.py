"""Seed Neon Database for Team Integration with Production Monitoring Agent (Agent 02).

Creates and seeds:
1. risk_alerts (including alert #88)
2. fact_inventory_daily_snapshot (seeded from raw CSV with both IN-TN-01/CHENNAI-01 and IN-KA-01/BLR-01)
3. fact_stock_transfer_order (with sample transfer orders)
4. agent_run_logs (logs for each agent execution)
"""
import os
import sys
from datetime import datetime, date, timedelta
import pandas as pd
from sqlalchemy import create_engine, text
import dotenv

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

print(f"Connecting to Neon DB: {db_url[:40]}...")
engine = create_engine(db_url)

CREATE_TABLES_SQL = """
-- 1. Risk Alerts Table
CREATE TABLE IF NOT EXISTS risk_alerts (
    id SERIAL PRIMARY KEY,
    customer_order_id VARCHAR(50),
    material_id VARCHAR(100),
    plant_id VARCHAR(50),
    severity VARCHAR(20),
    message TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fact Inventory Daily Snapshot (Exact Schema requested by Agent 02)
CREATE TABLE IF NOT EXISTS fact_inventory_daily_snapshot (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    plant_id VARCHAR(50) NOT NULL,              -- 'CHENNAI-01', 'BLR-01', 'IN-TN-01', 'IN-KA-01'
    material_id VARCHAR(100) NOT NULL,          -- 'MAT-SOC-001'
    warehouse_id VARCHAR(100) NOT NULL,         -- 'WH-RAW-01', 'RM-WH-01'
    lot_id VARCHAR(100) NOT NULL,               -- Batch / Lot trace number
    on_hand_qty INT NOT NULL DEFAULT 0,
    allocated_qty INT NOT NULL DEFAULT 0,
    blocked_qty INT NOT NULL DEFAULT 0,
    quality_hold_qty INT NOT NULL DEFAULT 0,
    safety_stock_qty INT NOT NULL DEFAULT 0,
    inventory_status VARCHAR(50) NOT NULL       -- 'AVAILABLE', 'BUFFER_WARNING', 'HOLD', 'CRITICAL_STOCKOUT'
);

-- Indexes for fast filtering by Monitoring Agent
CREATE INDEX IF NOT EXISTS idx_fids_mat_plant ON fact_inventory_daily_snapshot (material_id, plant_id);
CREATE INDEX IF NOT EXISTS idx_fids_date ON fact_inventory_daily_snapshot (snapshot_date);

-- 3. Fact Stock Transfer Order (Exact Schema requested by Agent 02)
CREATE TABLE IF NOT EXISTS fact_stock_transfer_order (
    transfer_order_id VARCHAR(50) PRIMARY KEY,  -- e.g. 'STO-20261120-001'
    alert_id INT,                               -- Links back to risk_alerts(id)
    material_id VARCHAR(50) NOT NULL,
    from_plant_id VARCHAR(50) NOT NULL,         -- e.g. 'BLR-01' (Surplus facility)
    to_plant_id VARCHAR(50) NOT NULL,           -- e.g. 'CHENNAI-01' (Constrained facility)
    transfer_qty INT NOT NULL,                  -- e.g. 500 units
    transit_mode VARCHAR(20) DEFAULT 'ROAD',    -- 'ROAD' (24h) or 'AIR_CARGO' (6h)
    dispatched_at TIMESTAMP,
    expected_arrival_ts TIMESTAMP NOT NULL,
    transfer_status VARCHAR(50) DEFAULT 'REQUESTED', -- 'REQUESTED', 'IN_TRANSIT', 'RECEIVED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

def main():
    with engine.begin() as conn:
        print("Creating tables if not present...")
        conn.execute(text(CREATE_TABLES_SQL))
        print("Tables created successfully.")

        # Check existing row count in fact_inventory_daily_snapshot
        cur_count = conn.execute(text("SELECT count(*) FROM fact_inventory_daily_snapshot")).scalar()
        print(f"Current rows in fact_inventory_daily_snapshot: {cur_count}")

        if cur_count < 100:
            csv_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'fact_inventory_daily_snapshot.csv')
            if os.path.exists(csv_path):
                print(f"Reading snapshot CSV from {csv_path}...")
                df = pd.read_csv(csv_path)
                print(f"Loaded {len(df)} rows from CSV.")

                # Filter to latest 30 days to keep snapshot lean and lightning fast
                df['snapshot_date'] = pd.to_datetime(df['snapshot_date']).dt.date
                max_date = df['snapshot_date'].max()
                min_date = max_date - timedelta(days=35)
                df_recent = df[df['snapshot_date'] >= min_date].copy()
                print(f"Filtered to recent window: {len(df_recent)} rows (from {min_date} to {max_date})")

                # Prepare standard rows
                insert_rows = []
                for _, r in df_recent.iterrows():
                    insert_rows.append({
                        'snapshot_date': r['snapshot_date'],
                        'plant_id': str(r['plant_id']),
                        'material_id': str(r['material_id']),
                        'warehouse_id': str(r['warehouse_id']),
                        'lot_id': str(r['lot_id']),
                        'on_hand_qty': int(r['on_hand_qty']),
                        'allocated_qty': int(r['allocated_qty']),
                        'blocked_qty': int(r['blocked_qty']),
                        'quality_hold_qty': int(r['quality_hold_qty']),
                        'safety_stock_qty': int(r['safety_stock_qty']),
                        'inventory_status': str(r['inventory_status']),
                    })

                # Also add alias plant_id rows ('CHENNAI-01' for 'IN-TN-01', 'BLR-01' for 'IN-KA-01')
                # for the latest snapshot date so teammate queries matching either convention work!
                latest_rows = df[df['snapshot_date'] == max_date].copy()
                alias_map = {'IN-TN-01': 'CHENNAI-01', 'IN-KA-01': 'BLR-01'}
                for _, r in latest_rows.iterrows():
                    plant_alias = alias_map.get(str(r['plant_id']))
                    if plant_alias:
                        # Determine buffer status
                        net_usable = int(r['on_hand_qty']) - (int(r['allocated_qty']) + int(r['blocked_qty']) + int(r['quality_hold_qty']))
                        ss = int(r['safety_stock_qty'])
                        if net_usable <= 0:
                            buf_status = 'CRITICAL_STOCKOUT'
                        elif net_usable < ss:
                            buf_status = 'BUFFER_BREACHED'
                        else:
                            buf_status = 'HEALTHY'

                        insert_rows.append({
                            'snapshot_date': r['snapshot_date'],
                            'plant_id': plant_alias,
                            'material_id': str(r['material_id']),
                            'warehouse_id': str(r['warehouse_id']),
                            'lot_id': str(r['lot_id']),
                            'on_hand_qty': int(r['on_hand_qty']),
                            'allocated_qty': int(r['allocated_qty']),
                            'blocked_qty': int(r['blocked_qty']),
                            'quality_hold_qty': int(r['quality_hold_qty']),
                            'safety_stock_qty': ss,
                            'inventory_status': buf_status,
                        })

                print(f"Inserting {len(insert_rows)} rows into fact_inventory_daily_snapshot...")
                # Insert in chunks
                chunk_size = 500
                for i in range(0, len(insert_rows), chunk_size):
                    chunk = insert_rows[i:i+chunk_size]
                    conn.execute(
                        text("""
                            INSERT INTO fact_inventory_daily_snapshot 
                            (snapshot_date, plant_id, material_id, warehouse_id, lot_id, on_hand_qty, allocated_qty, blocked_qty, quality_hold_qty, safety_stock_qty, inventory_status)
                            VALUES (:snapshot_date, :plant_id, :material_id, :warehouse_id, :lot_id, :on_hand_qty, :allocated_qty, :blocked_qty, :quality_hold_qty, :safety_stock_qty, :inventory_status)
                        """),
                        chunk
                    )
                print("Snapshot table seeded successfully.")

        # 4. Seed risk_alerts (if not exists)
        ra_count = conn.execute(text("SELECT count(*) FROM risk_alerts")).scalar()
        if ra_count == 0:
            print("Seeding risk_alerts...")
            conn.execute(text("""
                INSERT INTO risk_alerts (id, customer_order_id, material_id, plant_id, severity, message, status)
                VALUES 
                (88, 'CO-000065', 'MAT-SOC-001', 'CHENNAI-01', 'CRITICAL', 'SoC Processor below safety stock buffer for order CO-000065', 'IN_REMEDIATION'),
                (89, 'CO-000072', 'MAT-PCB-004', 'BLR-01', 'CRITICAL', '6-layer Main PCB delivery slipped +18 days; Day 18 line stop risk', 'ACTIVE'),
                (90, 'CO-000084', 'MAT-CAM-007', 'CHENNAI-01', 'HIGH', 'Rear camera module buffer depletion within 5 days', 'ACTIVE')
                ON CONFLICT (id) DO NOTHING;
            """))
            # Reset sequence to max id
            conn.execute(text("SELECT setval(pg_get_serial_sequence('risk_alerts', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM risk_alerts;"))
            print("risk_alerts seeded.")

        # 5. Seed fact_stock_transfer_order
        sto_count = conn.execute(text("SELECT count(*) FROM fact_stock_transfer_order")).scalar()
        if sto_count == 0:
            print("Seeding fact_stock_transfer_order...")
            now = datetime.now()
            conn.execute(text("""
                INSERT INTO fact_stock_transfer_order 
                (transfer_order_id, alert_id, material_id, from_plant_id, to_plant_id, transfer_qty, transit_mode, dispatched_at, expected_arrival_ts, transfer_status)
                VALUES 
                ('STO-20261120-001', 88, 'MAT-SOC-001', 'BLR-01', 'CHENNAI-01', 400, 'ROAD', :disp1, :arr1, 'IN_TRANSIT'),
                ('STO-20261120-002', 89, 'MAT-PCB-004', 'CHENNAI-01', 'BLR-01', 1200, 'ROAD', :disp2, :arr2, 'REQUESTED')
                ON CONFLICT (transfer_order_id) DO NOTHING;
            """), {
                'disp1': now - timedelta(hours=4),
                'arr1': now + timedelta(hours=20),
                'disp2': None,
                'arr2': now + timedelta(hours=24),
            })
            print("fact_stock_transfer_order seeded.")

        # 6. Ensure agent_run_logs has rich multi-agent records
        agent_log_count = conn.execute(text("SELECT count(*) FROM agent_run_logs")).scalar()
        print(f"Current agent_run_logs: {agent_log_count}")
        if agent_log_count < 20:
            print("Adding additional agent_run_logs entries for AGT-01 through AGT-07...")
            # We can log recent agent runs
            runs = [
                {
                    'tenant_id': 'ORG-01',
                    'username': 'admin',
                    'run_id': 41,
                    'question': 'Autonomous Reconcile ERP, MES, and WMS inventory snapshot variances',
                    'route': 'reconcile',
                    'specialist': 'AGT-01: Data Reconciler',
                    'tool_calls': '["reconcile_variance", "verify_lots"]',
                    'answer': 'Reconciliation completed across 18 materials. Resolved 4 lot mismatches, verified 0 phantom stock.',
                    'status': 'success',
                    'domo_calls': 1,
                    'latency_ms': 120,
                    'usage': '{"tokens": 420}'
                },
                {
                    'tenant_id': 'ORG-01',
                    'username': 'admin',
                    'run_id': 41,
                    'question': 'Evaluate Shortage Horizon for Aster 15 box-build assembly lines',
                    'route': 'shortages',
                    'specialist': 'AGT-03: Shortage Forecast',
                    'tool_calls': '["project_stockout_curves", "bom_depletion_vector"]',
                    'answer': 'Pinpointed Day 18 line stop on MAT-PCB-004 (6-layer Main PCB). Recommended PO-8821 expedite and transfer of 1,200 EA from Chennai.',
                    'status': 'success',
                    'domo_calls': 2,
                    'latency_ms': 240,
                    'usage': '{"tokens": 850}'
                },
                {
                    'tenant_id': 'ORG-01',
                    'username': 'admin',
                    'run_id': 41,
                    'question': 'Evaluate Inter-Plant Transfer Feasibility from BLR-01 to CHENNAI-01 for Alert #88 (MAT-SOC-001)',
                    'route': 'transfer_feasibility',
                    'specialist': 'AGT-05: Replenishment & Transfer',
                    'tool_calls': '["check_surplus_buffer", "calculate_transfer_order"]',
                    'answer': 'Surplus of 1,850 EA identified at BLR-01. Initiated STO-20261120-001 for 400 units via Dedicated Road Express (ETA: 20 hours).',
                    'status': 'success',
                    'domo_calls': 1,
                    'latency_ms': 180,
                    'usage': '{"tokens": 610}'
                }
            ]
            for r in runs:
                conn.execute(text("""
                    INSERT INTO agent_run_logs 
                    (tenant_id, username, run_id, question, route, specialist, tool_calls, answer, status, domo_calls, latency_ms, usage, at)
                    VALUES 
                    (:tenant_id, :username, :run_id, :question, :route, :specialist, CAST(:tool_calls AS jsonb), :answer, :status, :domo_calls, :latency_ms, CAST(:usage AS jsonb), NOW())
                """), r)
            print("Agent run logs updated.")

    print("\n✅ Verification Summary:")
    with engine.connect() as conn:
        for tbl in ['fact_inventory_daily_snapshot', 'fact_stock_transfer_order', 'risk_alerts', 'materials', 'plants', 'proposals', 'agent_run_logs']:
            c = conn.execute(text(f"SELECT count(*) FROM {tbl}")).scalar()
            print(f"  • {tbl}: {c} rows")

if __name__ == '__main__':
    main()
