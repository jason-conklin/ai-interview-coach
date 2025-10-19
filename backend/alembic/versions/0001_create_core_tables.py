"""create core tables

Revision ID: 0001
Revises:
Create Date: 2025-10-18 19:28:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    question_category_enum = sa.Enum(
        "behavioral",
        "technical",
        "role_specific",
        name="questioncategory",
        native_enum=False,
    )
    session_tier_enum = sa.Enum("Exploring", "Emerging", "Ready", name="sessiontier", native_enum=False)

    question_category_enum.create(op.get_bind(), checkfirst=True)
    session_tier_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "role",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_role")),
        sa.UniqueConstraint("name", name=op.f("uq_role_name")),
        sa.UniqueConstraint("slug", name=op.f("uq_role_slug")),
    )
    op.create_index(op.f("ix_role_slug"), "role", ["slug"], unique=False)

    op.create_table(
        "question",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("category", question_category_enum, nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("expected_duration_sec", sa.Integer(), nullable=True),
        sa.Column("keywords", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["role_id"], ["role.id"], name=op.f("fk_question_role_id_role"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_question")),
        sa.UniqueConstraint("role_id", "text", name=op.f("uq_question_role_text")),
    )
    op.create_index(op.f("ix_question_role_id"), "question", ["role_id"], unique=False)

    op.create_table(
        "session",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("summary_tier", session_tier_enum, nullable=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["role_id"], ["role.id"], name=op.f("fk_session_role_id_role"), ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session")),
    )
    op.create_index(op.f("ix_session_role_id"), "session", ["role_id"], unique=False)

    op.create_table(
        "answer",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("transcript_text", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["question_id"], ["question.id"], name=op.f("fk_answer_question_id_question"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["session.id"], name=op.f("fk_answer_session_id_session"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_answer")),
    )
    op.create_index(op.f("ix_answer_session_id"), "answer", ["session_id"], unique=False)

    op.create_table(
        "evaluation",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("answer_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("rubric", sa.JSON(), nullable=False),
        sa.Column("feedback_markdown", sa.Text(), nullable=False),
        sa.Column("suggested_improvements", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.ForeignKeyConstraint(
            ["answer_id"], ["answer.id"], name=op.f("fk_evaluation_answer_id_answer"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evaluation")),
        sa.UniqueConstraint("answer_id", name=op.f("uq_evaluation_answer_id")),
    )


def downgrade() -> None:
    op.drop_table("evaluation")
    op.drop_index(op.f("ix_answer_session_id"), table_name="answer")
    op.drop_table("answer")
    op.drop_index(op.f("ix_session_role_id"), table_name="session")
    op.drop_table("session")
    op.drop_index(op.f("ix_question_role_id"), table_name="question")
    op.drop_table("question")
    op.drop_index(op.f("ix_role_slug"), table_name="role")
    op.drop_table("role")

    session_tier_enum = sa.Enum("Exploring", "Emerging", "Ready", name="sessiontier", native_enum=False)
    question_category_enum = sa.Enum("behavioral", "technical", "role_specific", name="questioncategory", native_enum=False)
    session_tier_enum.drop(op.get_bind(), checkfirst=True)
    question_category_enum.drop(op.get_bind(), checkfirst=True)
