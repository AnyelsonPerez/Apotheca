"""add treatment_days and dose_start_date to lots

Revision ID: a3f7c1e2b9d4
Revises: 8fe59c95a5ab
Create Date: 2026-11-27 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c1e2b9d4'
down_revision: Union[str, Sequence[str], None] = '8fe59c95a5ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('lots', sa.Column('treatment_days', sa.Float(), nullable=True))
    op.add_column('lots', sa.Column('dose_start_date', sa.Date(), nullable=True))
    # Backfill dose_start_date for existing lots that have a daily_dose but no start date;
    # fall back to created_at so their depletion alerts continue to fire instead of going silent.
    op.execute("""
        UPDATE lots
        SET dose_start_date = DATE(created_at)
        WHERE daily_dose IS NOT NULL
          AND daily_dose > 0
          AND dose_start_date IS NULL
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('lots', 'dose_start_date')
    op.drop_column('lots', 'treatment_days')
