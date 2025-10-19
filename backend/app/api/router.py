from fastapi import APIRouter

from app.api.v1 import evaluate, history, questions, roles, sessions

api_router = APIRouter()
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(evaluate.router, prefix="/evaluate", tags=["evaluation"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
