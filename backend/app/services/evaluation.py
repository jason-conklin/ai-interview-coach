from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from app.models.enums import QuestionCategory, SessionTier


def tier_for_score(score: float) -> SessionTier:
    if score < 5.0:
        return SessionTier.EXPLORING
    if score < 7.5:
        return SessionTier.EMERGING
    return SessionTier.READY


SYSTEM_PROMPT = """You are an experienced interview coach helping candidates prepare for interviews.
Evaluate the candidate's answer using the correct rubric for the question category.

Rubric expectations:
- Behavioral: Assess STAR completeness, quantifiable impact/metrics, reflection.
- Technical: Assess correctness, tradeoffs, clarity, algorithmic/architecture complexity, concrete examples.
- Role-specific: Assess relevant tools/processes, best practices, practical depth.

Instructions:
- Provide a clear numeric score from 0-10.
- Offer concise, constructive feedback that is directly actionable.
- Suggest up to three improvements tailored to the candidate's answer.
- Do not make legal statements or guarantee hiring outcomes; instead, speak about readiness tiers.
- Keep feedback factual and encouraging.
"""


@dataclass
class EvaluationPayload:
    score: float
    feedback_markdown: str
    rubric: Dict[str, Any]
    suggested_improvements: List[str]
    readiness_tier: SessionTier


def default_rubric(category: QuestionCategory) -> Dict[str, Any]:
    base = {
        "clarity": 0.0,
        "structure": 0.0,
        "relevance": 0.0,
        "specificity": 0.0,
        "use_of_metrics": 0.0,
    }
    if category == QuestionCategory.BEHAVIORAL:
        base.update({"star_completeness": 0.0, "reflection": 0.0})
    elif category == QuestionCategory.TECHNICAL:
        base.update({"correctness": 0.0, "tradeoffs": 0.0, "complexity": 0.0})
    else:
        base.update({"tools_processes": 0.0, "best_practices": 0.0, "practical_depth": 0.0})
    return base
