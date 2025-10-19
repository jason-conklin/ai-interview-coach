from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampMetadata(ORMModel):
    started_at: datetime
    ended_at: datetime | None = None

    @property
    def duration_ms(self) -> int | None:
        if self.started_at and self.ended_at:
            return int((self.ended_at - self.started_at).total_seconds() * 1000)
        return None


class RubricBreakdown(ORMModel):
    rubric: Dict[str, Any]
