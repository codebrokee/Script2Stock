"""Query generation with shape diversity and concept expansion.

Shapes per scene (4-8 queries):
- noun chunks + "stock footage"
- named entities + "aerial" / "close up"
- concept-expanded concrete visual phrases
- verb-object pairs

Rules: every query is 2-4 words, concrete nouns preferred, deduped.
Extraction (spaCy with regex fallback) is reused from the legacy module.
"""
from __future__ import annotations

import re

from ..query_generator import STOPWORDS, WORD_RE, extract_keywords
from .concept_map import expand_concepts

GENERIC_FILLERS = ["stock footage", "aerial view", "close up", "city life", "nature scenery", "people walking"]


def _trim_words(text: str, n: int) -> str:
    return " ".join(text.split()[:n])


def generate_queries(narration: str, max_queries: int = 8) -> list[str]:
    kw = extract_keywords(narration)
    out: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        q = _trim_words(re.sub(r"\s+", " ", q.strip().lower()), 4)
        words = q.split()
        if len(words) < 2 or len(words) > 4:
            return
        if q not in seen:
            seen.add(q)
            out.append(q)

    for noun in kw["noun_chunks"][:3]:
        add(f"{_trim_words(noun, 2)} stock footage")
    for ent in kw["entities"][:2]:
        short = _trim_words(ent, 2)
        add(f"{short} aerial")
        add(f"{short} close up")
    for phrase in expand_concepts(narration, kw["entities"])[:4]:
        add(phrase)
    for vo in kw["verb_objects"][:2]:
        add(vo)

    if len(out) < 4:
        nouns = [w for w in WORD_RE.findall(narration.lower()) if w not in STOPWORDS and len(w) > 2]
        for i in range(0, len(nouns) - 1, 2):
            add(f"{nouns[i]} {nouns[i + 1]}")
            if len(out) >= 4:
                break
    for filler in GENERIC_FILLERS:
        if len(out) >= 4:
            break
        add(filler)
    return out[:max_queries]
