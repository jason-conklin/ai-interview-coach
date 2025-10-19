from enum import Enum


class QuestionCategory(str, Enum):
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    ROLE_SPECIFIC = "role_specific"


class SessionTier(str, Enum):
    EXPLORING = "Exploring"
    EMERGING = "Emerging"
    READY = "Ready"
