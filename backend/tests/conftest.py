from __future__ import annotations

import asyncio
from pathlib import Path
from typing import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.init_db import load_seed_data
from app.db.session import session_context

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> AsyncIterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _seed_database(session_factory: async_sessionmaker[AsyncSession]) -> None:
    seed_path = Path(__file__).resolve().parents[1] / "app" / "seeds" / "seed_roles_and_questions.json"
    async with session_factory() as session:
        await load_seed_data(session=session, seed_path=seed_path)


@pytest.fixture(scope="session")
async def app_fixture() -> AsyncIterator[FastAPI]:
    settings.database_url = TEST_DATABASE_URL
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
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    yield application

    await engine.dispose()


@pytest.fixture()
async def client(app_fixture: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(app=app_fixture, base_url="http://testserver") as test_client:
        yield test_client
