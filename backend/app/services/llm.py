from __future__ import annotations

import asyncio
import json
import random
import re
import time
from inspect import Parameter, signature
from typing import Any, Dict, List, Optional, Tuple

import structlog

try:
    from openai import AsyncOpenAI, OpenAIError
except ImportError:  # pragma: no cover - optional dependency
    AsyncOpenAI = None  # type: ignore[assignment]
    OpenAIError = Exception  # type: ignore[misc,assignment]

from app.core.config import settings
from app.models.enums import QuestionCategory
from app.services.evaluation import EvaluationPayload, SYSTEM_PROMPT, default_rubric, tier_for_score
from app.services.evaluator_status import set_status

CODE_BLOCK_PLACEHOLDER = "[REDACTED_CODE_BLOCK]"
_CODE_FENCE_PATTERN = re.compile(r"```.*?```", re.DOTALL)
_TILDE_FENCE_PATTERN = re.compile(r"~~~.*?~~~", re.DOTALL)

EVAL_MODEL_NAME = settings.eval_model
EVALUATION_JSON_SCHEMA = """
{
  "score": number between 0 and 10,
  "feedback_markdown": string,
  "rubric": object,
  "suggested_improvements": array of strings
}
""".strip()


def _redact_code_snippets(text: str) -> str:
    if not text:
        return text
    redacted = _CODE_FENCE_PATTERN.sub(CODE_BLOCK_PLACEHOLDER, text)
    redacted = _TILDE_FENCE_PATTERN.sub(CODE_BLOCK_PLACEHOLDER, redacted)
    processed_lines = []
    for line in redacted.splitlines():
        stripped = line.strip()
        if not stripped:
            processed_lines.append(line)
            continue
        non_alnum_ratio = 0.0
        if stripped:
            non_alnum_ratio = sum(1 for ch in stripped if not ch.isalnum() and ch not in {" ", "_", "-", "."}) / len(stripped)
        if (
            len(stripped) > 120
            or stripped.startswith(("def ", "class ", "function ", "#include", "public ", "private "))
            or ("{" in stripped and "}" in stripped)
            or non_alnum_ratio > 0.4
        ):
            processed_lines.append(CODE_BLOCK_PLACEHOLDER)
        else:
            processed_lines.append(line)
    return "\n".join(processed_lines)


def _code_detection_score(question_text: str, answer_text: str, requires_code: bool) -> float:
    score = 1.0 if requires_code else 0.0
    for snippet in (question_text, answer_text):
        lower = snippet.lower()
        if "```" in lower:
            score += 0.5
        if "~~~" in lower:
            score += 0.3
        if any(token in lower for token in ("def ", "class ", "function ", "lambda ", "#include", "public ", "private ")):
            score += 0.4
        if any(token in lower for token in (";", "{", "}")):
            score += 0.2
        lines = [ln for ln in lower.splitlines() if ln.strip()]
        if lines:
            code_lines = sum(
                1
                for ln in lines
                if ln.strip().startswith(("def ", "class ", "for ", "while ", "if ", "public ", "private "))
                or ln.strip().endswith(";")
            )
            score += min(0.3, code_lines / len(lines))
    return min(score / 1.5, 1.0)


def _extract_response_text(response: Any) -> str:
    if not response:
        return ""
    text = getattr(response, "output_text", None)
    if text:
        return text
    output = getattr(response, "output", None)
    if output:
        chunks: List[str] = []
        for block in output:
            contents = getattr(block, "content", None)
            if contents:
                for part in contents:
                    value = getattr(part, "text", None)
                    if value:
                        chunks.append(value)
        if chunks:
            return "\n".join(chunks)
    return ""


def _clean_json_payload(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[\w]*\n?", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    cleaned = cleaned.strip()
    cleaned = re.sub(r",\s*}", "}", cleaned)
    cleaned = re.sub(r",\s*]", "]", cleaned)
    return cleaned


def _truncate_text(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


logger = structlog.get_logger(__name__)


class LLMQuotaError(RuntimeError):
    pass


class LLMEvaluationService:
    _cooldown_until: Optional[float] = None

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._provider = settings.llm_provider
        self._base_url = settings.llm_base_url
        base_url = self._base_url

        if self._provider == "custom":
            effective_key = api_key or settings.llm_api_key or settings.openai_api_key or "lm-studio"
        else:
            effective_key = api_key or settings.openai_api_key

        self._api_key = effective_key
        self._should_stub = _should_use_stub()

        client_kwargs: Dict[str, Any] = {}
        if effective_key:
            client_kwargs["api_key"] = effective_key
        if base_url:
            client_kwargs["base_url"] = base_url

        if self._should_stub or AsyncOpenAI is None or (self._provider == "custom" and not base_url):
            self._client = None
        else:
            try:
                self._client = AsyncOpenAI(**client_kwargs) if client_kwargs.get("api_key") else None
            except TypeError:
                # Older openai clients may not accept base_url; retry without it.
                fallback_kwargs = dict(client_kwargs)
                fallback_kwargs.pop("base_url", None)
                self._client = AsyncOpenAI(**fallback_kwargs) if fallback_kwargs.get("api_key") else None

        logger.info(
            "llm_client_initialized",
            provider=self._provider,
            base_url=base_url or "default",
            has_client=self._client is not None,
            use_stub=self._should_stub,
        )

        self._supports_responses = self._supports_responses_json()

    def _status_context(self) -> Dict[str, Optional[str]]:
        return {"provider": self._provider, "base_url": self._base_url}

    def _log_context(self) -> Dict[str, Any]:
        return {"provider": self._provider, "base_url": self._base_url or "default"}
    @classmethod
    def _cooldown_active(cls) -> bool:
        if cls._cooldown_until is None:
            return False
        return time.time() < cls._cooldown_until

    @classmethod
    def _trigger_cooldown(cls) -> None:
        cls._cooldown_until = time.time() + max(0, settings.eval_cooldown_seconds)

    def _supports_responses_json(self) -> bool:
        if not self._client or not hasattr(self._client, "responses"):
            return False
        create = getattr(self._client.responses, "create", None)
        if create is None:
            return False
        try:
            sig = signature(create)
            params = sig.parameters
            for name, param in params.items():
                if name == "response_format":
                    return True
                if param.kind == Parameter.VAR_KEYWORD:
                    return True
        except (TypeError, ValueError):
            return True
        return False

    async def _llm_json_single(self, user_prompt: str) -> Tuple[str, str]:
        if not self._client:
            raise RuntimeError("LLM client is not configured.")

        # Preferred path: Responses API with JSON mode
        if self._supports_responses and hasattr(self._client, "responses"):
            try:
                response = await self._client.responses.create(
                    model=EVAL_MODEL_NAME,
                    input=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                ],
                temperature=settings.eval_temperature,
                top_p=settings.eval_top_p,
                presence_penalty=settings.eval_presence_penalty,
                frequency_penalty=settings.eval_frequency_penalty,
                max_output_tokens=settings.eval_max_output_tokens,
                response_format={"type": "json_object"},
            )
                logger.info("llm_path", path="responses_json", **self._log_context())
                return _extract_response_text(response), "llm_json_mode"
            except TypeError as exc:
                logger.warning("llm_path", path="responses_json", error=str(exc), **self._log_context())
                self._supports_responses = False
            except Exception as exc:
                logger.warning("llm_path", path="responses_json", error=str(exc), **self._log_context())

        chat_api = getattr(getattr(self._client, "chat", None), "completions", None)
        if chat_api:
            # Attempt chat completions with JSON mode (if supported)
            try:
                response = await chat_api.create(
                    model=EVAL_MODEL_NAME,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": f"{user_prompt}\nReturn ONLY valid JSON matching this schema:\n{EVALUATION_JSON_SCHEMA}",
                        },
                    ],
                    temperature=settings.eval_temperature,
                    top_p=settings.eval_top_p,
                    presence_penalty=settings.eval_presence_penalty,
                    frequency_penalty=settings.eval_frequency_penalty,
                    max_tokens=settings.eval_max_output_tokens,
                    response_format={"type": "json_object"},
                )
                message = response.choices[0].message.content if response.choices else ""
                logger.info("llm_path", path="chat_json", **self._log_context())
                return message or "", "llm_chat_fallback"
            except TypeError as exc:
                logger.warning("llm_path", path="chat_json", error=str(exc), **self._log_context())
            except Exception as exc:
                logger.warning("llm_path", path="chat_json", error=str(exc), **self._log_context())

            # Final fallback: chat completions with strict instruction only
            response = await chat_api.create(
                model=EVAL_MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"{user_prompt}\nReturn ONLY valid JSON matching this schema:\n{EVALUATION_JSON_SCHEMA}\n"
                            "Do not include any markdown fences or explanation text."
                        ),
                    },
                ],
                temperature=settings.eval_temperature,
                top_p=settings.eval_top_p,
                presence_penalty=settings.eval_presence_penalty,
                frequency_penalty=settings.eval_frequency_penalty,
                max_tokens=settings.eval_max_output_tokens,
            )
            message = response.choices[0].message.content if response.choices else ""
            logger.info("llm_path", path="chat_instruction_only", **self._log_context())
            return message or "", "llm_chat_fallback"

        raise RuntimeError("No supported OpenAI API method available for JSON responses.")

    @staticmethod
    def _is_quota_error(exc: Exception) -> bool:
        message = str(exc).lower()
        if "insufficient_quota" in message or "quota" in message:
            return True
        status = getattr(exc, "status_code", None)
        if status == 429:
            return True
        code = getattr(exc, "code", "")
        if isinstance(code, str) and "quota" in code.lower():
            return True
        return False

    async def _llm_json_request(self, user_prompt: str) -> Tuple[str, str]:
        delays = [0.25, 0.5, 1.0]
        for attempt, delay in enumerate(delays):
            try:
                return await self._llm_json_single(user_prompt)
            except OpenAIError as exc:
                if self._is_quota_error(exc):
                    if attempt == len(delays) - 1:
                        raise LLMQuotaError(str(exc)) from exc
                    jitter = random.uniform(0, delay / 2)
                    await asyncio.sleep(delay + jitter)
                    continue
                raise
        raise LLMQuotaError("Quota exhausted after retries.")

    async def evaluate_answer(
        self,
        *,
        answer_text: str,
        question_text: str,
        category: QuestionCategory,
        role_name: str,
        requires_code: bool = False,
        question_keywords: Optional[List[str]] = None,
        debug_force_llm: bool = False,
    ) -> Tuple[EvaluationPayload, Optional[Dict[str, Any]]]:
        debug_override = settings.debug_force_llm or debug_force_llm
        code_score = _code_detection_score(question_text, answer_text, requires_code)
        code_like = code_score >= settings.code_detection_threshold or requires_code
        meta: Optional[Dict[str, Any]] = None

        if not settings.use_llm and not debug_override:
            logger.info("evaluation_path", path="heuristic", reason="use_llm_disabled", **self._log_context())
            set_status(path="heuristic", reason="use_llm_disabled", model="offline-heuristic", **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            return payload, meta

        if not debug_override and self._cooldown_active():
            logger.info("evaluation_path", path="heuristic", reason="llm_quota_cooldown", **self._log_context())
            set_status(path="heuristic", reason="llm_quota", model="offline-heuristic", **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            meta = {
                "fallback": "heuristic",
                "reason": "llm_quota",
                "message": "OpenAI quota exceeded; used offline evaluation.",
            }
            return payload, meta

        if not debug_override and not settings.allow_llm_for_code and code_like:
            logger.info(
                "evaluation_path",
                path="heuristic",
                reason="code_question_forced",
                code_score=code_score,
                **self._log_context(),
            )
            set_status(path="heuristic", reason="code_question_forced", model="offline-heuristic", **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            return payload, meta

        if (self._should_stub and not debug_override) or not self._client or AsyncOpenAI is None:
            logger.warning("evaluation_path", path="heuristic", reason="client_unavailable", **self._log_context())
            set_status(path="heuristic", reason="client_unavailable", model="offline-heuristic", **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            return payload, meta

        status_reason = "debug_force_llm" if debug_override else ("llm_code_allowed" if code_like else "success")

        question_for_model = _truncate_text(question_text, settings.eval_max_input_chars)
        answer_for_model = _truncate_text(answer_text, settings.eval_max_input_chars)
        if code_like or debug_override or settings.allow_llm_for_code:
            question_for_model = _truncate_text(_redact_code_snippets(question_text), settings.eval_max_input_chars)
            answer_for_model = _truncate_text(_redact_code_snippets(answer_text), settings.eval_max_input_chars)

        try:
            user_prompt = (
                f"Role: {role_name}\n"
                f"Category: {category.value}\n"
                f"Question: {question_for_model}\n"
                f"Answer: {answer_for_model}\n\n"
                "Respond ONLY with JSON using the following schema:\n"
                f"{EVALUATION_JSON_SCHEMA}\n"
            )
            raw_json, mode_reason = await self._llm_json_request(user_prompt)
            cleaned = _clean_json_payload(raw_json)
            try:
                payload = json.loads(cleaned)
            except json.JSONDecodeError:
                payload = json.loads(_clean_json_payload(cleaned))
            score = float(payload.get("score", 0))
            rubric: Dict[str, Any] = payload.get("rubric") or default_rubric(category)
            feedback_markdown = payload.get("feedback_markdown") or "Keep practicing to improve your responses."
            suggested_improvements: List[str] = payload.get("suggested_improvements") or [
                "Provide more concrete examples to back your answer.",
            ]
            readiness_tier = tier_for_score(score)
            set_status(path="llm", reason=status_reason, model=EVAL_MODEL_NAME, mode=mode_reason, **self._status_context())
            debug_payload = None
            if settings.quality_debug_enabled:
                debug_payload = {
                    "path": "llm",
                    "reason": status_reason,
                    "mode": mode_reason,
                    "code_score": code_score,
                    "code_like": code_like,
                    "debug_override": debug_override,
                    "redacted": question_text != question_for_model or answer_text != answer_for_model,
                }
            logger.info(
                "evaluation_path",
                path="llm",
                model=EVAL_MODEL_NAME,
                score=score,
                tier=readiness_tier.value,
                reason=status_reason,
                **self._log_context(),
            )
            meta = None
            if status_reason == "debug_force_llm":
                meta = {"mode": mode_reason}
            return EvaluationPayload(
                score=score,
                feedback_markdown=feedback_markdown,
                rubric=rubric,
                suggested_improvements=suggested_improvements[:3],
                readiness_tier=readiness_tier,
                debug=debug_payload,
            ), meta
        except LLMQuotaError:
            self._trigger_cooldown()
            logger.warning("evaluation_path", path="heuristic", reason="llm_quota", **self._log_context())
            set_status(path="heuristic", reason="llm_quota", model="offline-heuristic", **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            meta = {
                "fallback": "heuristic",
                "reason": "llm_quota",
                "message": "OpenAI quota exceeded; used offline evaluation.",
            }
            return payload, meta
        except (OpenAIError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("evaluation_path", path="heuristic", reason="llm_exception", error=str(exc), **self._log_context())
            set_status(path="heuristic", reason="llm_exception", model="offline-heuristic", error=str(exc), **self._status_context())
            payload = self._offline_evaluation(
                answer_text=answer_text,
                question_text=question_text,
                category=category,
                requires_code=requires_code,
                keywords=question_keywords,
            )
            return payload, meta

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
        requires_code: bool = False,
        keywords: Optional[List[str]] = None,
    ) -> EvaluationPayload:
        normalized = answer_text.strip()
        if not normalized:
            debug_payload = None
            if settings.quality_debug_enabled:
                debug_payload = {
                    "fallback": True,
                    "reason": "empty_answer",
                }
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
                debug=debug_payload,
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
        code_tokens = ["def ", "class ", "return ", "lambda ", "yield "]
        code_detected = requires_code or any(token in lower_answer for token in code_tokens)
        if code_detected:
            total_score = max(total_score, 6.0)

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
        debug_payload = None
        if settings.quality_debug_enabled:
            debug_payload = {
                "fallback": True,
                "reason": "heuristic_offline",
                "weights": None,
                "sampling": {
                    "temperature": settings.eval_temperature,
                    "top_p": settings.eval_top_p,
                    "presence_penalty": settings.eval_presence_penalty,
                    "frequency_penalty": settings.eval_frequency_penalty,
                },
                "metrics_detected": has_metrics,
                "star_hits": star_hits,
                "code_detected": code_detected,
                "word_count": word_count,
            }

        return EvaluationPayload(
            score=total_score,
            feedback_markdown=feedback_markdown,
            rubric=rubric,
            suggested_improvements=suggestions[:3],
            readiness_tier=tier_for_score(total_score),
            debug=debug_payload,
        )


def _should_use_stub() -> bool:
    return not settings.use_llm











