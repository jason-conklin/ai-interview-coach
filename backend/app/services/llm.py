from __future__ import annotations

import json
import os
import re
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
        question_keywords: Optional[List[str]] = None,
    ) -> EvaluationPayload:
        if requires_code:
            return self._code_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                question_keywords=question_keywords,
            )

        if self._should_stub or not self._client:
            logger.warning("OPENAI_API_KEY not configured; returning offline evaluation.")
            return self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                keywords=question_keywords,
            )

        if AsyncOpenAI is None:
            logger.warning("openai package not installed; using offline evaluation.")
            return self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                keywords=question_keywords,
            )

        try:
            user_prompt = (
                f"Role: {role_name}\n"
                f"Category: {category.value}\n"
                f"Question: {question_text}\n"
                f"Answer: {answer_text}\n\n"
                "Respond ONLY with JSON using the following schema:\n"
                "{\n"
                '  "score": float 0-10,\n'
                '  "feedback_markdown": string,\n'
                '  "rubric": object,\n'
                '  "suggested_improvements": [string, ...]\n'
                "}\n"
            )
            response = await self._client.responses.create(
                model="gpt-4.1-mini",
                input=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
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
            return self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                keywords=question_keywords,
            )

    def _code_evaluation(
        self, *, answer_text: str, question_text: str, question_keywords: Optional[List[str]] = None
    ) -> EvaluationPayload:
        normalized = answer_text.strip()
        if not normalized:
            return EvaluationPayload(
                score=2.0,
                feedback_markdown=(
                    "No code was provided. Share a compilable snippet and explain the approach to receive targeted feedback."
                ),
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

        lowered = normalized.lower()
        has_function = any(token in lowered for token in ["def ", "function ", "class "])
        has_control_flow = any(keyword in lowered for keyword in ["for ", "while ", "if ", "match "])
        mentions_tests = any(keyword in lowered for keyword in ["assert", "test", "unit", "expect"])
        documents_examples = "input" in lowered and "output" in lowered
        mentions_complexity = "o(" in lowered or "complexity" in lowered or "big-o" in lowered
        includes_comments = any(line.strip().startswith(("#", "//")) for line in normalized.splitlines())
        length_bonus = min(3, max(0, len(normalized.splitlines()) // 4))

        score = 4.0
        if has_function:
            score += 2.5
        if has_control_flow:
            score += 1.5
        if mentions_tests:
            score += 1.0
        if includes_comments:
            score += 0.5
        if mentions_complexity:
            score += 0.5
        if documents_examples:
            score += 0.5
        score += length_bonus
        score = round(min(score, 10.0), 2)

        rubric = {
            "structure": 10.0 if has_function else 6.0,
            "readability": 8.5 if includes_comments else 5.5,
            "correctness": 7.5 if has_control_flow else 4.5,
            "tests": 7.0 if mentions_tests else 3.0,
        }

        improvements: List[str] = []
        if not has_function:
            improvements.append("Wrap the solution in a named function or class to match production patterns.")
        if not has_control_flow:
            improvements.append("Demonstrate the core algorithm with loops or conditionals to prove correctness.")
        if not mentions_tests:
            improvements.append("Show how you would test the code, e.g. with assertions or unit test snippets.")
        if not documents_examples:
            examples_hint = "Reference sample inputs/outputs from the prompt to prove the code works."
            improvements.append(examples_hint)
        if not mentions_complexity:
            improvements.append("State the time/space complexity to show you understand performance trade-offs.")
        if question_keywords and not any(kw.lower() in lowered for kw in question_keywords):
            improvements.append("Mention domain specifics such as " + ", ".join(question_keywords[:2]) + " to tailor the answer.")
        if not improvements:
            improvements.append("Consider additional edge cases and annotate the code with expected outcomes.")

        seen = set()
        filtered: List[str] = []
        for item in improvements:
            key = item.strip()
            if key and key not in seen:
                filtered.append(key)
                seen.add(key)
            if len(filtered) == 3:
                break

        focus_hint = question_keywords[0] if question_keywords else question_text.splitlines()[0].strip()
        strength_lines = ["Code Review Insights -"]
        if has_function:
            strength_lines.append("- Reusable structure detected: function or class keeps the solution modular.")
        if has_control_flow:
            strength_lines.append("- Control flow present: loops or branches demonstrate how the algorithm executes.")
        if mentions_tests:
            strength_lines.append("- Testing signals: mentions assertions or test ideas for reliability.")
        if documents_examples:
            strength_lines.append("- Example walkthrough: references sample input/output to prove correctness.")
        if mentions_complexity:
            strength_lines.append("- Complexity awareness: time and space trade-offs are acknowledged.")
        if question_keywords:
            strength_lines.append(f"- Prompt alignment: references {focus_hint}.")
        if len(strength_lines) == 1:
            strength_lines.append("- Baseline code submitted. Build on this with structure, tests, and examples.")
        feedback_markdown = "\n".join(strength_lines)
        return EvaluationPayload(
            score=score,
            feedback_markdown=feedback_markdown,
            rubric=rubric,
            suggested_improvements=filtered,
            readiness_tier=tier_for_score(score),
        )

    def _offline_evaluation(
        self,
        *,
        answer_text: str,
        question_text: str,
        category: QuestionCategory,
        keywords: Optional[List[str]] = None,
    ) -> EvaluationPayload:
        normalized = answer_text.strip()
        if not normalized:
            return EvaluationPayload(
                score=2.5,
                feedback_markdown=(
                    "No response detected. Share your thought process so the coach can highlight strengths and next steps."
                ),
                rubric=default_rubric(category),
                suggested_improvements=[
                    "Draft a full response before submitting to receive targeted guidance.",
                    "Reference the prompt directly and describe your approach step-by-step.",
                ],
                readiness_tier=tier_for_score(2.5),
            )

        lower_answer = normalized.lower()
        word_count = len(normalized.split())
        has_metrics = bool(re.search(r"\d", normalized))
        star_hits = sum(1 for token in ["situation", "task", "action", "result", "impact"] if token in lower_answer)
        mentions_customer = any(token in lower_answer for token in ["customer", "client", "stakeholder"])
        references_role = False
        if keywords:
            references_role = any(kw.lower() in lower_answer for kw in keywords)
        else:
            focus_tokens = [token.strip().lower() for token in re.split(r"[,;]", question_text)[:3]]
            references_role = any(token and token in lower_answer for token in focus_tokens)

        length_score = min(5.0, word_count / 25.0)
        structure_score = min(3.0, star_hits * 0.7)
        metrics_score = 1.0 if has_metrics else 0.0
        role_score = 1.0 if references_role else 0.3
        total_score = round(min(10.0, 2.0 + length_score + structure_score + metrics_score + role_score), 2)

        rubric = default_rubric(category)
        for key in rubric:
            if key in {"clarity", "structure"}:
                rubric[key] = round(min(10.0, 4 + structure_score * 2), 2)
            elif key in {"specificity", "use_of_metrics", "metrics"}:
                rubric[key] = round(3.0 + metrics_score * 6, 2)
            else:
                rubric[key] = round(min(10.0, 3 + length_score * 1.6), 2)

        suggestions: List[str] = []
        if star_hits < 3 and category == QuestionCategory.BEHAVIORAL:
            suggestions.append("Walk through Situation, Task, Action, and Result so the story lands clearly.")
        if not has_metrics:
            suggestions.append("Quantify the outcome (e.g. % improvement, time saved) to underscore impact.")
        if not references_role and keywords:
            suggestions.append("Weave in domain specifics such as " + ", ".join(keywords[:2]) + " to show role alignment.")
        if category == QuestionCategory.TECHNICAL and "complexity" not in lower_answer:
            suggestions.append("State algorithmic complexity or trade-offs you considered.")
        if not mentions_customer and category == QuestionCategory.BEHAVIORAL:
            suggestions.append("Describe who benefited (customer, stakeholder, team) and how.")
        if len(suggestions) < 3:
            supplemental = [
                "Call out key risks or mitigations you handled during the work.",
                "Highlight the tools or frameworks you chose and why.",
                "Outline a quick follow-up or learning you would apply next time.",
            ]
            for item in supplemental:
                if item not in suggestions:
                    suggestions.append(item)
                if len(suggestions) == 3:
                    break

        focus_hint = (
            ", ".join(keywords[:2])
            if keywords
            else question_text.splitlines()[0].strip().split(".")[0]
        )
        strength_lines = ["Coaching Highlights -"]
        if word_count >= 150:
            strength_lines.append(f"- Response depth: {word_count} words provide strong context.")
        if star_hits >= 3:
            strength_lines.append("- Structured story: clearly covers the situation, actions, and results.")
        if has_metrics:
            strength_lines.append("- Impact signals: includes measurable outcomes or metrics.")
        if references_role:
            strength_lines.append("- Role alignment: ties the example to the domain and expectations.")
        if mentions_customer:
            strength_lines.append("- Audience awareness: identifies who benefited from the work.")
        if len(strength_lines) == 1:
            strength_lines.append("- Solid starting point. Build it out with more detail and measurable outcomes.")
        strength_lines.append(f"- Prompt emphasis: {focus_hint}")
        feedback_markdown = "\n".join(strength_lines)
        return EvaluationPayload(
            score=total_score,
            feedback_markdown=feedback_markdown,
            rubric=rubric,
            suggested_improvements=suggestions[:3],
            readiness_tier=tier_for_score(total_score),
        )


def _should_use_stub() -> bool:
    env_flag = (settings.app_env or "").lower()
    if env_flag in {"test", "ci"}:
        return True
    if os.environ.get("CI", "").lower() == "true":
        return True
    return False
