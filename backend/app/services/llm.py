from __future__ import annotations

import json
from typing import Any, Dict, List

import structlog
from openai import AsyncOpenAI, OpenAIError

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
    def __init__(self, api_key: str | None = None) -> None:
        api_key = api_key or settings.openai_api_key
        self._api_key = api_key
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def evaluate_answer(
        self,
        *,
        answer_text: str,
        question_text: str,
        category: QuestionCategory,
        role_name: str,
    ) -> EvaluationPayload:
        if not self._client:
            logger.warning("OPENAI_API_KEY not configured; returning offline evaluation.")
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
