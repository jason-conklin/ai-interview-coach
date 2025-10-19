"""add role level and code flags"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


rolelevel_enum = sa.Enum(
    "internship",
    "entry",
    "mid",
    "senior",
    "staff",
    name="rolelevel",
    native_enum=False,
)


def upgrade() -> None:
    rolelevel_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "question",
        sa.Column("level", rolelevel_enum, nullable=False, server_default="entry"),
    )
    op.add_column(
        "question",
        sa.Column("requires_code", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "session",
        sa.Column("level", rolelevel_enum, nullable=False, server_default="entry"),
    )

    op.execute("UPDATE question SET level='entry' WHERE level IS NULL")
    op.execute("UPDATE session SET level='entry' WHERE level IS NULL")

    op.alter_column("question", "level", server_default=None)
    op.alter_column("question", "requires_code", server_default=None)
    op.alter_column("session", "level", server_default=None)


def downgrade() -> None:
    op.drop_column("session", "level")
    op.drop_column("question", "requires_code")
    op.drop_column("question", "level")
    rolelevel_enum.drop(op.get_bind(), checkfirst=True)

