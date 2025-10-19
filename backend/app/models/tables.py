from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import QuestionCategory, SessionTier


class Role(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    questions: Mapped[List["Question"]] = relationship(back_populates="role", cascade="all, delete-orphan")
    sessions: Mapped[List["Session"]] = relationship(back_populates="role")


class Question(Base):
    __table_args__ = (
        UniqueConstraint("role_id", "text", name="uq_question_role_text"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("role.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[QuestionCategory] = mapped_column(Enum(QuestionCategory, native_enum=False), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    expected_duration_sec: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    keywords: Mapped[List[str]] = mapped_column(JSON, default=list)

    role: Mapped["Role"] = relationship(back_populates="questions")
    answers: Mapped[List["Answer"]] = relationship(back_populates="question")


class Session(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("role.id", ondelete="RESTRICT"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    summary_tier: Mapped[Optional[SessionTier]] = mapped_column(Enum(SessionTier, native_enum=False), nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(nullable=True)

    role: Mapped["Role"] = relationship(back_populates="sessions")
    answers: Mapped[List["Answer"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    @hybrid_property
    def duration_ms(self) -> Optional[int]:
        if self.started_at and self.ended_at:
            return int((self.ended_at - self.started_at).total_seconds() * 1000)
        return None


class Answer(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("session.id", ondelete="CASCADE"), index=True, nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("question.id", ondelete="RESTRICT"), nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    ended_at: Mapped[datetime] = mapped_column(nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    transcript_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped["Session"] = relationship(back_populates="answers")
    question: Mapped["Question"] = relationship(back_populates="answers")
    evaluation: Mapped[Optional["Evaluation"]] = relationship(
        back_populates="answer", cascade="all, delete-orphan", uselist=False
    )


class Evaluation(Base):
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    answer_id: Mapped[int] = mapped_column(ForeignKey("answer.id", ondelete="CASCADE"), unique=True, nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    rubric: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    feedback_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_improvements: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    answer: Mapped["Answer"] = relationship(back_populates="evaluation")
