"""inventory_projections.demand_source: both demand sources per run (D31)

Revision ID: c7d31a2e9f10
Revises: af67d347bb14
Create Date: 2026-11-12 12:00:00

Existing rows take their run's configured demand source.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d31a2e9f10'
down_revision: Union[str, Sequence[str], None] = 'af67d347bb14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inventory_projections',
                  sa.Column('demand_source', sa.String(length=32), server_default='scenario', nullable=False))
    op.execute("""
        UPDATE inventory_projections p
           SET demand_source = r.config::jsonb ->> 'demand_source'
          FROM calculation_runs r
         WHERE r.id = p.run_id AND (r.config::jsonb ->> 'demand_source') IS NOT NULL
           AND (r.config::jsonb ->> 'demand_source') <> 'scenario'
    """)
    op.create_index('ix_inventory_projections_run_source', 'inventory_projections', ['run_id', 'demand_source'])
    op.create_index('ix_material_status_run_source', 'material_status', ['run_id', 'demand_source'])


def downgrade() -> None:
    op.drop_index('ix_material_status_run_source', table_name='material_status')
    op.drop_index('ix_inventory_projections_run_source', table_name='inventory_projections')
    op.drop_column('inventory_projections', 'demand_source')
