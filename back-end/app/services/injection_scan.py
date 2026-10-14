"""Local, heuristic warning layer; never a replacement for AI trust boundaries."""
import re
import unicodedata

# Requests are matched anywhere in document text, with or without quotes.
# Contract-information requests deliberately trigger a warning even when benign.
_REQUEST = r"\b(?:what\s+(?:is|are)|what['’]s|give|tell|show|reveal|print|return|output|expose|provide|send|share|list|retrieve|disclose)\b"
_REQUEST_TARGET = (
    r"\b(?:api[\s_-]*keys?|secret[\s_-]*keys?|access[\s_-]*tokens?|"
    r"passwords?|credentials?|system\s+prompts?|developer\s+(?:messages?|instructions?)|"
    r"contracts?\s+(?:info(?:rmation)?|details?|data|contents?|terms))\b"
)

_PATTERNS = tuple(re.compile(pattern, re.IGNORECASE) for pattern in (
    r"\b(?:ignore|disregard|forget|override|bypass)\b.{0,80}\b(?:instructions?|commands?|prompts?|rules?|guidelines?|polic(?:y|ies)|safeguards?)\b",
    r"\b(?:reveal|print|show|return|output|expose)\b.{0,60}\b(?:system prompt|developer (?:message|instructions)|api key|secret key)\b",
    _REQUEST + r"[^.!?;]{0,100}" + _REQUEST_TARGET,
    r"\b(?:you are now|act as|pretend to be)\b.{0,60}\b(?:unrestricted|unfiltered|jailbroken|developer|system|admin)\b",
    r"(?:\[\s*system\s*\]|<\|(?:im_start|system|im_end)\|>|</?(?:system|developer)>)",
))


def has_possible_injection(pages):
    text = unicodedata.normalize("NFKC", "\n".join(text for _, text in pages))
    text = "".join(char for char in text if unicodedata.category(char) != "Cf")
    text = " ".join(text.split())
    return any(pattern.search(text) for pattern in _PATTERNS)
