from __future__ import annotations

from typing import Any, Dict, Optional


_LAST_STATUS: Dict[str, Any] = {
    "path": "unknown",
    "reason": "not_evaluated",
    "mode": None,
    "model": None,
    "error": None,
    "provider": None,
    "base_url": None,
}


def set_status(
    *,
    path: str,
    reason: str,
    model: Optional[str] = None,
    error: Optional[str] = None,
    mode: Optional[str] = None,
    provider: Optional[str] = None,
    base_url: Optional[str] = None,
) -> None:
    _LAST_STATUS.update(
        {
            "path": path,
            "reason": reason,
            "mode": mode,
            "model": model,
            "error": error,
            "provider": provider,
            "base_url": base_url,
        }
    )


def get_status() -> Dict[str, Any]:
    return dict(_LAST_STATUS)
