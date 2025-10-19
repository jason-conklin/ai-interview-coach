from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.enums import RoleLevel, SessionTier
from app.schemas.question import QuestionRead
from app.schemas.role import RoleRead
from app.services.evaluation import tier_for_score


class SessionCreate(BaseModel):
    role_slug: str = Field(..., examples=["software-developer"])
    level: RoleLevel = Field(default=RoleLevel.ENTRY)


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: RoleRead
    level: RoleLevel
    started_at: datetime
    ended_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    summary_tier: Optional[SessionTier] = None


class AnswerCreate(BaseModel):
    question_id: int
    answer_text: str
    started_at: datetime
    ended_at: datetime
    transcript_text: Optional[str] = None


class RubricBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    clarity: Optional[float] = None
    correctness: Optional[float] = None
    structure: Optional[float] = None
    relevance: Optional[float] = None
    specificity: Optional[float] = None
    metrics: Optional[float] = None
    additional: Optional[Dict[str, Any]] = None


class EvaluationRequest(BaseModel):
    answer_id: int


class EvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    score: float
    rubric: Dict[str, Any]
    feedback_markdown: str
    suggested_improvements: List[str]

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
    transcript_text: Optional[str] = None
    evaluation: Optional[EvaluationRead] = None


class SessionDetail(SessionRead):
    answers: List[AnswerRead] = []


class HistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: RoleRead
    level: RoleLevel
    started_at: datetime
    ended_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    summary_tier: Optional[SessionTier] = None


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
