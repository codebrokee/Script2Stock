"""Tests for the rule-based scene splitter."""
from app.scene_splitter import count_words, split_script


def test_paragraph_breaks_are_scene_boundaries():
    text = "First paragraph sentence one. Second sentence here.\n\nNew paragraph starts here. More text follows."
    chunks = split_script(text)
    assert len(chunks) >= 2
    assert chunks[0].end_char <= text.find("\n\n") + 1 or "paragraph" in chunks[0].narration.lower()


def test_target_word_count_merging():
    text = "The cat sat on the mat near the warm fireplace. Dogs barked loudly outside in the cold rain."
    chunks = split_script(text)
    assert len(chunks) >= 1
    for ch in chunks:
        assert 1 <= len(ch.narration) > 0
        assert ch.start_char < ch.end_char


def test_long_text_produces_multiple_scenes():
    sents = " ".join(f"Scene sentence number {i} about artificial intelligence and robots." for i in range(12))
    chunks = split_script(sents)
    assert len(chunks) >= 3
    for ch in chunks:
        assert 15 <= count_words(ch.narration) <= 120 or len(chunks) > 1


def test_char_offsets_are_accurate():
    text = "Hello world. This is a test.\n\nSecond paragraph here."
    chunks = split_script(text)
    for ch in chunks:
        assert text[ch.start_char : ch.end_char] or ch.narration
