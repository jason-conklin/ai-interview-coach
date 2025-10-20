from __future__ import annotations

import asyncio
import json
from pathlib import Path

import structlog
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.base import Base
from app.models.enums import QuestionCategory, RoleLevel
from app.models.tables import Answer, Question, Role

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

        text_variants = [entry["text"], *entry.get("legacy_texts", [])]
        question_stmt = select(Question).where(
            Question.role_id == role.id,
            Question.text.in_(text_variants),
        )
        questions_result = await session.execute(question_stmt)
        matching_questions = questions_result.scalars().all()

        if matching_questions:
            primary = next((question for question in matching_questions if question.text == entry["text"]), matching_questions[0])
            extras = [question for question in matching_questions if question is not primary]

            for extra in extras:
                await session.execute(
                    update(Answer)
                    .where(Answer.question_id == extra.id)
                    .values(question_id=primary.id)
                )
                await session.delete(extra)

            if primary.text != entry["text"]:
                primary.text = entry["text"]
            primary.category = QuestionCategory(entry["category"])
            primary.level = RoleLevel(entry.get("level", "entry"))
            primary.difficulty = entry["difficulty"]
            primary.expected_duration_sec = entry.get("expected_duration_sec")
            primary.requires_code = bool(entry.get("requires_code", False))
            primary.keywords = entry.get("keywords", [])
            continue

        question = Question(
            role_id=role.id,
            text=entry["text"],
            category=QuestionCategory(entry["category"]),
            level=RoleLevel(entry.get("level", "entry")),
            difficulty=entry["difficulty"],
            expected_duration_sec=entry.get("expected_duration_sec"),
            requires_code=bool(entry.get("requires_code", False)),
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
