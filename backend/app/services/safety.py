from __future__ import annotations

import re


CRISIS_PATTERNS = [
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bsuicide\b",
    r"\bsuicidal\b",
    r"\bself[- ]?harm\b",
    r"\bhurt myself\b",
    r"\bcan't go on\b",
    r"\bno reason to live\b",
]

CRISIS_RECOMMENDATION = (
    "This may include self-harm or suicide risk. If there is immediate danger, call local emergency services now. "
    "In the U.S. or Canada, call or text 988 for the Suicide & Crisis Lifeline. "
    "If outside the U.S., contact a local crisis line or a trusted person nearby."
)

GENERAL_RECOMMENDATION = (
    "This is an AI sentiment analysis, not a diagnosis. Consider speaking with a licensed mental health professional "
    "if these feelings are intense, persistent, or affecting daily life."
)

DISCLAIMER = (
    "This tool provides sentiment analysis only and does not replace medical, psychological, or emergency care."
)


def detect_crisis(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(pattern, lowered) for pattern in CRISIS_PATTERNS)


def recommendation_for(crisis_detected: bool) -> str:
    return CRISIS_RECOMMENDATION if crisis_detected else GENERAL_RECOMMENDATION
