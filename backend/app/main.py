from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import create_engine_and_sessionmaker, session_context
from app.api.router import api_router
from app.utils.logging import configure_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting AI Interview Coach backend")

    engine, session_factory = create_engine_and_sessionmaker(settings.database_url)
    session_context.configure(session_factory=session_factory)

    yield

    logger.info("Shutting down AI Interview Coach backend")


def get_application() -> FastAPI:
    app = FastAPI(
        title="AI Interview Coach API",
        version="0.1.0",
        description="Backend services for the AI Interview Coach platform.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/healthz", tags=["health"])
    async def health_check():
        return {"status": "ok"}

    return app


app = get_application()
