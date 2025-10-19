from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.enums import QuestionCategory, SessionTier
from app.schemas.question import QuestionRead
from app.services.evaluation import tier_for_score
from app.schemas.role import RoleRead


class SessionCreate(BaseModel):
    role_slug: str = Field(..., examples=["software-developer"])


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: RoleRead
    started_at: datetime
    ended_at: datetime | None = None
    overall_score: float | None = None
    summary_tier: SessionTier | None = None


class AnswerCreate(BaseModel):
    question_id: int
    answer_text: str
    started_at: datetime
    ended_at: datetime
    transcript_text: str | None = None


class RubricBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    clarity: float | None = None
    correctness: float | None = None
    structure: float | None = None
    relevance: float | None = None
    specificity: float | None = None
    metrics: float | None = None
    additional: dict[str, Any] | None = None


class EvaluationRequest(BaseModel):
    answer_id: int


class EvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    score: float
    rubric: dict[str, Any]
    feedback_markdown: str
    suggested_improvements: list[str]

    @computed_field(return_type=SessionTier)
    def readiness_tier(self) -> SessionTier:
        return tier_for_score(self.score)


class AnswerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: QuestionRead
    answer_text: str
    started_at: datetime
    ended_at: datetime
    duration_ms: int
    transcript_text: str | None = None
    evaluation: EvaluationRead | None = None


class SessionDetail(SessionRead):
    answers: list[AnswerRead] = []


class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: RoleRead
    started_at: datetime
    ended_at: datetime | None = None
    overall_score: float | None = None
    summary_tier: SessionTier | None = None


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
