from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncIterator, Dict

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.init_db import load_seed_data
from app.db.session import session_context

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


async def _seed_database(session_factory: async_sessionmaker[AsyncSession]) -> None:
    seed_path = Path(__file__).resolve().parents[1] / "app" / "seeds" / "seed_roles_and_questions.json"
    async with session_factory() as session:
        await load_seed_data(session=session, seed_path=seed_path)


@pytest_asyncio.fixture
async def app_fixture() -> AsyncIterator[FastAPI]:
    settings.database_url = TEST_DATABASE_URL
    settings.app_env = "test"
    os.environ.setdefault("APP_ENV", "test")
    os.environ.setdefault("CI", "true")

    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    session_context.configure(session_factory=session_factory)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await _seed_database(session_factory)

    application = FastAPI()
    application.include_router(api_router, prefix="/api/v1")

    @application.get("/healthz")
    async def health() -> Dict[str, str]:
        return {"status": "ok"}

    try:
        yield application
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def client(app_fixture: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app_fixture)
    async with AsyncClient(transport=transport, base_url="http://testserver") as test_client:
        yield test_client
