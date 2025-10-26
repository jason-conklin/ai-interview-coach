from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter

from app.core.config import settings
from app.services.evaluator_status import get_status

router = APIRouter()


@router.get("", summary="Runtime diagnostics for evaluator configuration")
async def diagnostics() -> Dict[str, Any]:
    status = get_status()
    reason = status.get("reason") or "not_evaluated"
    if reason == "not_evaluated" and not settings.use_llm:
        reason = "use_llm_disabled"

    eval_model = status.get("model")
    if not eval_model:
        eval_model = "offline-heuristic" if not settings.use_llm else "unknown"

    provider = settings.llm_provider
    base_url = status.get("base_url") or settings.llm_base_url

    return {
        "env": {
            "app_env": settings.app_env,
            "ci": settings.ci_mode,
        },
        "config": {
            "use_llm": settings.use_llm,
            "openai_key_present": bool(settings.openai_api_key),
            "llm_provider": provider,
            "llm_base_url": settings.llm_base_url,
            "llm_api_key_present": bool(settings.llm_api_key),
        },
        "reason": reason,
        "models": {
            "provider": provider,
            "base_url": base_url,
            "eval_model": eval_model,
        },
        "status": status,
    }
