"""Rule-based scene splitter.

Rules:
- Paragraph breaks (blank lines) are hard scene boundaries.
- Within a paragraph, split on sentence boundaries.
- Merge sentences into scenes of 1-3 sentences, targeting 15-40 words.
- Track start/end char offsets relative to the original script text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+(?=[A-Z0-9\"'“(\[])")
WORD_RE = re.compile(r"[A-Za-z0-9']+")


def split_sentences(paragraph: str) -> list[str]:
    paragraph = re.sub(r"\s+", " ", paragraph.strip())
    if not paragraph:
        return []
    parts = SENTENCE_RE.split(paragraph)
    # Handle text with no terminal punctuation -> single sentence
    return [p.strip() for p in parts if p.strip()]


def count_words(text: str) -> int:
    return len(WORD_RE.findall(text))


@dataclass
class SceneChunk:
    narration: str
    start_char: int
    end_char: int


def split_script(text: str) -> list[SceneChunk]:
    """Split full script text into scene chunks with char offsets."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    chunks: list[SceneChunk] = []
    # Paragraphs = blocks separated by blank lines; keep offsets via search
    paragraphs: list[tuple[str, int]] = []
    cursor = 0
    for block in re.split(r"\n\s*\n", text):
        if not block.strip():
            cursor += len(block) + 1
            continue
        start = text.find(block, cursor)
        if start == -1:
            start = cursor
        paragraphs.append((block, start))
        cursor = start + len(block)

    for para, para_start in paragraphs:
        sentences = split_sentences(para)
        if not sentences:
            continue
        # Locate each sentence offset inside the paragraph for accuracy
        sent_offsets: list[tuple[str, int, int]] = []
        search_from = 0
        for s in sentences:
            idx = para.find(s, search_from)
            if idx == -1:
                idx = search_from
            sent_offsets.append((s, para_start + idx, para_start + idx + len(s)))
            search_from = idx + len(s)

        # Greedy merge: 1-3 sentences, target 15-40 words
        i = 0
        while i < len(sent_offsets):
            group = [sent_offsets[i]]
            words = count_words(sent_offsets[i][0])
            # add up to 2 more sentences while under target
            while len(group) < 3 and i + len(group) < len(sent_offsets):
                nxt = sent_offsets[i + len(group)][0]
                if words >= 15 and words + count_words(nxt) > 40 and words >= 15:
                    break
                group.append(sent_offsets[i + len(group)])
                words += count_words(nxt)
                if words >= 40:
                    break
            # If a single sentence is very long (>60 words), keep it alone
            narration = " ".join(s for s, _, _ in group)
            chunks.append(
                SceneChunk(
                    narration=narration,
                    start_char=group[0][1],
                    end_char=group[-1][2],
                )
            )
            i += len(group)
    return chunks
