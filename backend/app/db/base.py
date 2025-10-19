from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase, declared_attr

convention: Dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)

    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

    def to_dict(self) -> dict[str, Any]:
        return {
            column.key: getattr(self, column.key)
            for column in self.__table__.columns  # type: ignore[attr-defined]
        }
