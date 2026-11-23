"""agent_run_logs.specialist: chosen specialist(s) and routing method (D38)

Revision ID: d38e1f0a2b11
Revises: c7d31a2e9f10
Create Date: 2026-11-12 15:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd38e1f0a2b11'
down_revision: Union[str, Sequence[str], None] = 'c7d31a2e9f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agent_run_logs', sa.Column('specialist', sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column('agent_run_logs', 'specialist')
