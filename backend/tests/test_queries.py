"""Tests for query generation (spaCy or regex fallback)."""
from app import query_generator
from app.query_generator import extract_keywords, generate_queries


def test_generate_queries_count():
    qs = generate_queries("Artificial intelligence is transforming modern cities with robots and neural networks.")
    assert 3 <= len(qs) <= 6
    assert len(set(qs)) == len(qs)


def test_concept_expansion():
    qs = generate_queries("AI will change everything about how we work and live.")
    joined = " ".join(qs)
    assert any(k in joined for k in ("artificial intelligence", "machine learning", "neural network", "ai"))


def test_regex_fallback_when_spacy_missing(monkeypatch):
    monkeypatch.setattr(query_generator, "_nlp", None)
    monkeypatch.setattr(query_generator, "_spacy_failed", True)
    kw = extract_keywords("The quick brown fox jumps over the lazy dog near the river.")
    assert kw["noun_chunks"], "fallback should produce nouns"
    qs = generate_queries("The quick brown fox jumps over the lazy dog near the river.")
    assert 1 <= len(qs) <= 6


def test_extract_keywords_shape():
    kw = extract_keywords("Apple Inc. announced a new product in California.")
    assert set(kw.keys()) == {"entities", "noun_chunks", "verb_objects"}
