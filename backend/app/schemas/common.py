from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampMetadata(ORMModel):
    started_at: datetime
    ended_at: Optional[datetime] = None

    @property
    def duration_ms(self) -> Optional[int]:
        if self.started_at and self.ended_at:
            return int((self.ended_at - self.started_at).total_seconds() * 1000)
        return None


class RubricBreakdown(ORMModel):
    rubric: Dict[str, Any]
