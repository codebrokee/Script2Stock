"""Abstract-concept and named-entity expansions to concrete visual phrases.

Stock footage search needs concrete nouns ("forest canopy"), but scripts talk
in abstractions ("growth", "freedom"). These maps bridge that gap.
"""
from __future__ import annotations

import re

# Abstract concept -> 2-4 concrete, provider-friendly visual phrases.
CONCEPT_MAP: dict[str, list[str]] = {
    "leadership": ["business meeting", "team huddle", "corner office"],
    "innovation": ["laboratory research", "prototype workshop", "inventor desk"],
    "growth": ["rising chart", "sprouting plant", "city skyline"],
    "freedom": ["flying birds", "open road", "raised flag"],
    "opportunity": ["open door", "sunrise horizon", "handshake deal"],
    "risk": ["tightrope walker", "storm clouds", "cliff edge"],
    "history": ["ancient ruins", "museum hall", "old manuscripts"],
    "success": ["trophy celebration", "finish line", "fireworks night"],
    "teamwork": ["rowing crew", "group huddle", "office collaboration"],
    "future": ["futuristic city", "robot hand", "neon lights"],
    "change": ["autumn leaves", "construction site", "turning pages"],
    "power": ["lion portrait", "hydroelectric dam", "skyscraper"],
    "wealth": ["gold bars", "luxury yacht", "mansion exterior"],
    "poverty": ["empty bowl", "slum street", "worn shoes"],
    "love": ["wedding couple", "holding hands", "heart sunset"],
    "war": ["soldiers silhouette", "battlefield smoke", "fighter jets"],
    "peace": ["dove flight", "calm lake", "meditation garden"],
    "knowledge": ["library shelves", "graduation caps", "open book"],
    "education": ["classroom lesson", "school bus", "students studying"],
    "health": ["morning run", "fresh vegetables", "doctor checkup"],
    "journey": ["mountain trail", "train window", "backpack travel"],
    "time": ["clock face", "hourglass sand", "calendar pages"],
    "money": ["cash stack", "coins close up", "stock chart"],
    "nature": ["forest canopy", "waterfall mist", "wildflowers meadow"],
    "technology": ["circuit board", "server room", "smartphone close up"],
    "food": ["street market", "chef cooking", "fresh produce"],
    "sports": ["stadium crowd", "sprint start", "soccer kick"],
    "music": ["concert stage", "guitar close up", "vinyl record"],
    "celebration": ["confetti crowd", "champagne toast", "parade floats"],
    "family": ["picnic park", "parents children", "home dinner"],
    "work": ["office desk", "factory line", "video call"],
    "travel": ["airplane wing", "passport stamps", "coastal drive"],
    "ocean": ["ocean waves", "coral reef", "sailing boat"],
    "mountain": ["snowy peak", "alpine lake", "cable car"],
    "desert": ["sand dunes", "camel caravan", "cactus sunset"],
    "winter": ["snowfall street", "ice skating", "fireplace glow"],
    "farming": ["wheat field", "tractor harvest", "dairy cows"],
    "business": ["handshake office", "glass tower", "board meeting"],
    "art": ["paint brushes", "gallery walls", "street mural"],
    "ai": ["artificial intelligence lab", "machine learning", "neural network"],
    "artificial intelligence": ["machine learning", "neural network", "robotics"],
}

# Named entity -> visual phrases (for entities NER finds or text mentions).
ENTITY_VISUAL_MAP: dict[str, list[str]] = {
    "roman empire": ["roman colosseum", "roman soldiers", "ancient rome"],
    "silicon valley": ["tech campus", "startup office", "california highway"],
    "wall street": ["stock exchange", "financial district", "wall street sign"],
    "eiffel tower": ["paris skyline", "eiffel tower aerial", "seine river"],
    "statue of liberty": ["new york harbor", "liberty aerial", "manhattan skyline"],
    "great wall of china": ["great wall aerial", "china mountains", "ancient wall"],
    "pyramids of giza": ["egypt pyramids", "desert pyramids", "sphinx close up"],
    "mount everest": ["himalayas aerial", "snowy summit", "mountain climbers"],
    "amazon rainforest": ["rainforest canopy", "jungle river", "tropical birds"],
    "sahara desert": ["desert dunes", "camel caravan", "oasis palms"],
    "hollywood": ["hollywood sign", "los angeles aerial", "film set"],
    "times square": ["times square night", "neon billboards", "city crowd"],
    "grand canyon": ["canyon aerial", "colorado river", "desert cliffs"],
    "niagara falls": ["waterfall aerial", "niagara mist", "falls rainbow"],
    "sydney opera house": ["sydney harbour", "opera house aerial", "city ferry"],
}

# Ambiguous term -> sense -> context keywords. disambiguate() picks the sense
# with the most keyword hits, or None on ties/unknowns.
AMBIGUOUS_TERMS: dict[str, dict[str, list[str]]] = {
    "apple": {
        "fruit orchard": ["fruit", "orchard", "eat", "food", "tree", "harvest"],
        "tech company": ["iphone", "mac", "silicon", "technology", "computer", "phone"],
    },
    "amazon": {
        "rainforest river": ["rainforest", "jungle", "river", "trees", "wildlife"],
        "online store": ["shopping", "delivery", "package", "ecommerce", "store"],
    },
    "coach": {
        "tour bus": ["bus", "tour", "travel", "road", "passengers"],
        "sports trainer": ["team", "training", "game", "players", "fitness"],
    },
    "crane": {
        "wading bird": ["bird", "wetland", "feathers", "lake", "wildlife"],
        "construction machine": ["construction", "building", "tower", "steel", "site"],
    },
    "bass": {
        "freshwater fish": ["fish", "lake", "fishing", "river", "water"],
        "low music": ["guitar", "music", "band", "sound", "concert"],
    },
    "java": {
        "indonesian island": ["indonesia", "island", "volcano", "bali", "asia"],
        "programming language": ["code", "software", "programming", "computer", "developer"],
    },
    "python": {
        "constrictor snake": ["snake", "jungle", "reptile", "wildlife", "forest"],
        "programming language": ["code", "software", "programming", "computer", "developer"],
    },
    "jaguar": {
        "big cat": ["cat", "jungle", "wildlife", "spots", "animal"],
        "luxury car": ["car", "driving", "road", "vehicle", "luxury"],
    },
}


def expand_concepts(scene_text: str, entities: list[str] | None = None) -> list[str]:
    """Concrete visual phrases for entities + abstract concepts in the text."""
    lowered = scene_text.lower()
    out: list[str] = []
    seen: set[str] = set()

    def add(phrase: str) -> None:
        p = phrase.strip().lower()
        if p and p not in seen:
            seen.add(p)
            out.append(p)

    for ent in entities or []:
        key = ent.lower().strip()
        if not key:
            continue
        for name, visuals in ENTITY_VISUAL_MAP.items():
            if name == key or name in key or key in name:
                for v in visuals:
                    add(v)

    for name, visuals in ENTITY_VISUAL_MAP.items():
        if re.search(rf"\b{re.escape(name)}\b", lowered):
            for v in visuals:
                add(v)

    matched = 0
    for concept, phrases in CONCEPT_MAP.items():
        if matched >= 3:
            break
        if re.search(rf"\b{re.escape(concept)}\b", lowered):
            matched += 1
            for phrase in phrases[:2]:
                add(phrase)
    return out


def disambiguate(term: str, context: str) -> str | None:
    """Best sense name for an ambiguous term given surrounding context."""
    senses = AMBIGUOUS_TERMS.get(term.lower().strip())
    if not senses:
        return None
    lowered = context.lower()
    scored = [
        (sense, sum(1 for kw in keywords if re.search(rf"\b{re.escape(kw)}\b", lowered)))
        for sense, keywords in senses.items()
    ]
    scored.sort(key=lambda kv: kv[1], reverse=True)
    if scored[0][1] == 0:
        return None
    if len(scored) > 1 and scored[0][1] == scored[1][1]:
        return None
    return scored[0][0]
