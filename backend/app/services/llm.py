from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import structlog

try:
    from openai import AsyncOpenAI, OpenAIError
except ImportError:  # pragma: no cover - optional dependency
    AsyncOpenAI = None  # type: ignore[assignment]
    OpenAIError = Exception  # type: ignore[misc,assignment]

from app.core.config import settings
from app.models.enums import QuestionCategory
from app.services.evaluation import (
    EvaluationPayload,
    SYSTEM_PROMPT,
    default_rubric,
    tier_for_score,
)

logger = structlog.get_logger(__name__)


class LLMEvaluationService:
    def __init__(self, api_key: Optional[str] = None) -> None:
        api_key = api_key or settings.openai_api_key
        self._api_key = api_key
        self._should_stub = _should_use_stub()

        if self._should_stub:
            self._client = None
        elif AsyncOpenAI is not None:
            self._client = AsyncOpenAI(api_key=api_key) if api_key else None
        else:
            self._client = None

    async def evaluate_answer(
        self,
        *,
        answer_text: str,
        question_text: str,
        category: QuestionCategory,
        role_name: str,
        requires_code: bool = False,
    ) -> EvaluationPayload:
        if requires_code:
            return self._code_evaluation(answer_text=answer_text, question_text=question_text)

        if self._should_stub or not self._client:
            logger.warning("OPENAI_API_KEY not configured; returning offline evaluation.")
            return self._offline_evaluation(answer_text=answer_text, category=category)

        if AsyncOpenAI is None:
            logger.warning("openai package not installed; using offline evaluation.")
            return self._offline_evaluation(answer_text=answer_text, category=category)

        try:
            response = await self._client.responses.create(
                model="gpt-4.1-mini",
                input=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": (
                            "Role: {role}\n"
                            "Category: {category}\n"
                            "Question: {question}\n"
                            "Answer: {answer}\n\n"
                            "Respond ONLY with JSON using the following schema:\n"
                            "{{\n"
                            '  "score": float 0-10,\n'
                            '  "feedback_markdown": string,\n'
                            '  "rubric": object,\n'
                            '  "suggested_improvements": [string, ...]\n'
                            "}}\n"
                        ).format(
                            role=role_name,
                            category=category.value,
                            question=question_text,
                            answer=answer_text,
                        ),
                    },
                ],
                response_format={"type": "json_object"},
            )
            content = response.output[0].content[0].text if response.output else "{}"
            payload = json.loads(content)
            score = float(payload.get("score", 0))
            rubric: Dict[str, Any] = payload.get("rubric") or default_rubric(category)
            feedback_markdown = payload.get("feedback_markdown") or "Keep practicing to improve your responses."
            suggested_improvements: List[str] = payload.get("suggested_improvements") or [
                "Provide more concrete examples to back your answer.",
            ]
            readiness_tier = tier_for_score(score)
            return EvaluationPayload(
                score=score,
                feedback_markdown=feedback_markdown,
                rubric=rubric,
                suggested_improvements=suggested_improvements[:3],
                readiness_tier=readiness_tier,
            )
        except (OpenAIError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.error("llm_evaluation_failed", error=str(exc))
            return self._offline_evaluation(answer_text=answer_text, category=category)

    def _code_evaluation(self, *, answer_text: str, question_text: str) -> EvaluationPayload:
        normalized = answer_text.strip()
        if not normalized:
            return EvaluationPayload(
                score=2.0,
                feedback_markdown=
                "No code was provided. Share a compilable snippet and explain the approach to receive targeted feedback.",
                rubric={
                    "structure": 1.0,
                    "readability": 1.0,
                    "correctness": 1.0,
                    "tests": 0.0,
                },
                suggested_improvements=[
                    "Include a working code snippet for the core logic.",
                    "Describe how you would validate the solution with tests.",
                ],
                readiness_tier=tier_for_score(2.0),
            )

        has_function = any(token in normalized for token in ["def ", "function ", "class "])
        has_control_flow = any(keyword in normalized for keyword in ["for ", "while ", "if ", "match "])
        mentions_tests = any(keyword in normalized.lower() for keyword in ["assert", "test", "unit"])
        explains = len([line for line in normalized.splitlines() if line.strip().startswith(("#", "//"))]) > 0 or "explain" in normalized.lower()
        length_bonus = min(3, max(0, len(normalized.splitlines()) // 4))

        score = 4.0
        if has_function:
            score += 2.5
        if has_control_flow:
            score += 1.5
        if mentions_tests:
            score += 1.0
        if explains:
            score += 0.5
        score += length_bonus
        score = round(min(score, 10.0), 2)

        rubric = {
            "structure": 10.0 if has_function else 6.0,
            "readability": 8.0 if explains else 5.0,
            "correctness": 7.0 if has_control_flow else 4.0,
            "tests": 6.0 if mentions_tests else 2.0,
        }

        improvements = []
        if not has_function:
            improvements.append("Show the core logic wrapped in a function or class so it can be reused.")
        if not has_control_flow:
            improvements.append("Demonstrate control flow (loops or conditionals) to cover the full behaviour.")
        if not mentions_tests:
            improvements.append("Outline how you would test the solution or add assertions.")
        if not explains:
            improvements.append("Add comments or a short explanation describing key steps.")
        if not improvements:
            improvements.append("Consider edge cases and mention how you would handle them.")

        feedback = (
            "Code response detected. Based on heuristic review, your structure earns {structure:.1f}/10. "
            "Share runnable code with tests when possible for stronger feedback."
        ).format(structure=rubric["structure"])

        return EvaluationPayload(
            score=score,
            feedback_markdown=feedback,
            rubric=rubric,
            suggested_improvements=improvements[:3],
            readiness_tier=tier_for_score(score),
        )

    def _offline_evaluation(
        self,
        *,
        answer_text: str,
        category: QuestionCategory,
    ) -> EvaluationPayload:
        word_count = len(answer_text.split())
        length_score = min(10.0, word_count / 20.0)
        score = round(length_score, 2)
        rubric = default_rubric(category)
        for key in rubric:
            rubric[key] = round(min(10.0, score * 0.9), 2)
        feedback = (
            "This automated evaluation is based on heuristic scoring because no LLM API key is configured. "
            "Aim for concrete examples, structured storytelling, and measurable impact."
        )
        improvements = [
            "Structure your answer using Situation, Task, Action, Result where applicable.",
            "Add quantifiable impact or metrics to demonstrate effectiveness.",
            "Highlight specific tools or techniques relevant to the role.",
        ]
        return EvaluationPayload(
            score=score,
            feedback_markdown=feedback,
            rubric=rubric,
            suggested_improvements=improvements,
            readiness_tier=tier_for_score(score),
        )


def _should_use_stub() -> bool:
    env_flag = (settings.app_env or "").lower()
    if env_flag in {"test", "ci"}:
        return True
    if os.environ.get("CI", "").lower() == "true":
        return True
    return False
