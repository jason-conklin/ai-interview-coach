from typing import List, Optional

from pydantic import Field

from app.models.enums import QuestionCategory as QuestionCategoryEnum, RoleLevel
from app.schemas.common import ORMModel


class QuestionRead(ORMModel):
    id: int
    role_id: int
    text: str
    category: QuestionCategoryEnum
    level: RoleLevel
    difficulty: int = Field(ge=1, le=5)
    expected_duration_sec: Optional[int] = None
    requires_code: bool = False
    keywords: List[str] = []
