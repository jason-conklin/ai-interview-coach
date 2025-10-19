from __future__ import annotations

import asyncio
import json
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.models.enums import QuestionCategory
from app.models.tables import Question, Role

logger = structlog.get_logger(__name__)


ROLE_DETAILS = {
    "software-developer": {
        "name": "Software Developer",
        "description": "Builds backend services, APIs, and core product features.",
    },
    "full-stack-developer": {
        "name": "Full-Stack Developer",
        "description": "Delivers end-to-end features spanning frontend and backend systems.",
    },
    "data-engineer": {
        "name": "Data Engineer",
        "description": "Designs and operates resilient data pipelines for analytics and ML workloads.",
    },
    "cyber-analyst": {
        "name": "Cyber Analyst",
        "description": "Monitors and responds to security threats across the environment.",
    },
}


async def load_seed_data(session: AsyncSession, seed_path: Path) -> None:
    if not seed_path.exists():
        raise FileNotFoundError(f"Seed file not found at {seed_path}")

    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    for entry in payload:
        role_slug = entry["role_slug"]
        details = ROLE_DETAILS.get(role_slug, {"name": role_slug.replace("-", " ").title(), "description": None})

        role = await session.scalar(select(Role).where(Role.slug == role_slug))
        if not role:
            role = Role(slug=role_slug, name=details["name"], description=details["description"])
            session.add(role)
            await session.flush()

        existing_question = await session.scalar(
            select(Question).where(Question.role_id == role.id, Question.text == entry["text"])
        )
        if existing_question:
            continue

        question = Question(
            role_id=role.id,
            text=entry["text"],
            category=QuestionCategory(entry["category"]),
            difficulty=entry["difficulty"],
            expected_duration_sec=entry.get("expected_duration_sec"),
            keywords=entry.get("keywords", []),
        )
        session.add(question)

    await session.commit()
    logger.info("seed_data_loaded")


async def main() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    seed_path = Path(__file__).resolve().parent.parent / "seeds" / "seed_roles_and_questions.json"
    async with async_session() as session:
        try:
            await load_seed_data(session, seed_path)
        except IntegrityError as exc:
            logger.error("seed_integrity_error", error=str(exc))
            await session.rollback()
            raise
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
