"""spaCy-based query generation with regex fallback.

Per scene extracts named entities, noun chunks, verb-object pairs and
emits 3-6 search queries.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Optional

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'\-]*")
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
    "we", "they", "them", "his", "her", "our", "your", "their", "as", "from",
    "into", "over", "after", "before", "between", "through", "during", "about",
    "there", "here", "what", "which", "who", "whom", "how", "when", "where",
    "why", "can", "could", "should", "would", "will", "just", "than", "then",
    "also", "very", "more", "most", "such", "only", "own", "same", "so",
}

CONCEPT_EXPANSIONS: dict[str, list[str]] = {
    "ai": ["artificial intelligence", "machine learning", "neural network"],
    "artificial intelligence": ["machine learning", "neural network", "robotics"],
    "crypto": ["cryptocurrency", "bitcoin", "blockchain"],
    "climate": ["climate change", "global warming", "renewable energy"],
    "space": ["outer space", "galaxy", "astronaut"],
    "ocean": ["sea", "underwater", "coral reef"],
    "city": ["urban", "downtown", "skyline"],
    "forest": ["woods", "jungle", "trees"],
    "money": ["finance", "investment", "stock market"],
    "health": ["wellness", "fitness", "medical"],
    "food": ["cooking", "cuisine", "restaurant"],
    "travel": ["vacation", "tourism", "airplane"],
    "robot": ["robotics", "automation", "humanoid robot"],
    "car": ["automobile", "driving", "highway"],
}

WANTED_ENT_LABELS = {"PERSON", "ORG", "GPE", "EVENT", "WORK_OF_ART", "PRODUCT", "FAC"}

_nlp: Optional[object] = None
_spacy_failed = False


def _get_nlp() -> Optional[object]:
    global _nlp, _spacy_failed
    if _nlp is not None or _spacy_failed:
        return _nlp
    try:
        import spacy  # type: ignore

        _nlp = spacy.load("en_core_web_sm")
        return _nlp
    except Exception:
        _spacy_failed = True
        return None


def _regex_nouns(text: str) -> list[str]:
    words = [w for w in WORD_RE.findall(text.lower()) if w not in STOPWORDS and len(w) > 2]
    freq = Counter(words)
    return [w for w, _ in freq.most_common(5)]


def _regex_verbs_objects(text: str) -> list[str]:
    # Naive fallback: bigrams of non-stopwords as pseudo verb-object pairs
    words = [w for w in WORD_RE.findall(text.lower()) if w not in STOPWORDS]
    pairs = [" ".join(words[i : i + 2]) for i in range(len(words) - 1)]
    return pairs[:5]


def extract_keywords(narration: str) -> dict[str, list[str]]:
    """Return {entities, noun_chunks, verb_objects}."""
    nlp = _get_nlp()
    entities: list[str] = []
    nouns: list[str] = []
    verb_objs: list[str] = []
    if nlp is not None:
        try:
            doc = nlp(narration)  # type: ignore[attr-defined]
            entities = [e.text.strip() for e in doc.ents if e.label_ in WANTED_ENT_LABELS and e.text.strip()]
            freq = Counter(c.text.strip().lower() for c in doc.noun_chunks if len(c.text.strip()) > 2)
            nouns = [t for t, _ in freq.most_common(5)]
            for tok in doc:
                if tok.pos_ == "VERB":
                    objs = [c for c in tok.children if c.dep_ in ("dobj", "obj", "attr", "pobj")]
                    if objs:
                        verb_objs.append(f"{tok.lemma_} {objs[0].text}".lower())
            verb_objs = verb_objs[:5]
            if nouns or entities:
                return {"entities": entities[:5], "noun_chunks": nouns, "verb_objects": verb_objs}
        except Exception:
            pass
    # regex fallback
    return {"entities": [], "noun_chunks": _regex_nouns(narration), "verb_objects": _regex_verbs_objects(narration)}


def generate_queries(narration: str, max_queries: int = 6) -> list[str]:
    kw = extract_keywords(narration)
    queries: list[str] = []
    seen: set[str] = set()

    def add(q: str) -> None:
        q = re.sub(r"\s+", " ", q.strip().lower())
        if q and len(q) > 1 and q not in seen:
            seen.add(q)
            queries.append(q)

    for ent in kw["entities"][:3]:
        add(f"{ent} stock footage")
    nouns = kw["noun_chunks"]
    for n in nouns[:3]:
        add(n)
    if len(nouns) >= 2:
        add(f"{nouns[0]} {nouns[1]}")
    for vo in kw["verb_objects"][:2]:
        add(vo)
    # concept expansions
    lowered = narration.lower()
    for concept, expansions in CONCEPT_EXPANSIONS.items():
        if re.search(rf"\b{re.escape(concept)}\b", lowered):
            for exp in expansions[:2]:
                add(exp)
            break
    # generic fallback: first meaningful words
    if len(queries) < 3:
        words = [w for w in WORD_RE.findall(narration.lower()) if w not in STOPWORDS]
        if words:
            add(" ".join(words[:3]))
    return queries[:max_queries] if len(queries) >= 3 else (queries + ["stock footage"])[:max_queries]
