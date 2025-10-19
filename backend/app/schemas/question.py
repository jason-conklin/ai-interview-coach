from pydantic import Field

from app.schemas.common import ORMModel
from app.models.enums import QuestionCategory as QuestionCategoryEnum


class QuestionRead(ORMModel):
    id: int
    role_id: int
    text: str
    category: QuestionCategoryEnum
    difficulty: int = Field(ge=1, le=5)
    expected_duration_sec: int | None = None
    keywords: list[str] = []
