# Script2Stock: Phased Implementation Plan

> Companion to the initiating prompt. This document specifies phases,
> gates, evidence artifacts, abort conditions, and reporting requirements
> for the next stretch of work. Read `CONTRIBUTING.md` (Rules A–H) first —
> nothing here suspends those rules.

---

## 0. How phases work

Each phase is a discrete unit of work that ends with a **Phase Report**.
The IDE does not start phase N+1 until phase N's report is accepted. The
report is a single message containing:

1. **Commit list** — every commit with hash and one-line description.
2. **Test count** — exact number before and after, with the delta
   attributed to new tests.
3. **Evidence artifacts** — paths to committed JSON/CSV/markdown files
   whose contents are reproduced in the report.
4. **Per-criterion verdict** — PASS / FAIL / PARTIAL for every acceptance
   criterion in the phase spec.
5. **Cost measurement** — wall-clock time and (where relevant) memory
   added by the change, measured not estimated.
6. **Recommendation** — PROCEED (all gates passed), HOLD (gates partially
   passed, decision needed), or ABORT (a gate failed; do not proceed
   without user input).

A phase is not "done" because the code compiles or the tests pass. It is
done when the evidence artifacts show the criterion values. If an
artifact can't be produced, the criterion is **FAIL**, not "probably
fine."

**Abort conditions** are explicit per phase. If any abort condition
fires, the IDE stops and reports. It does not roll back without saying
so, and it does not continue to the next task within the phase.

---

## 1. Phase overview

| Phase | Purpose | Gate | Abort condition |
|---|---|---|---|
| 1 | CLIP visual verification + scene duration estimate | Rank-0 match rate on pass-2 archive ≥ 15/32 with CLIP enabled; duration field present in manifest | CLIP causes rank-0 to drop below 11/32 |
| 2 | Cross-episode feedback model | Holdout AUC > 0.55 on pass-1→pass-2 split; neutral multiplier when < 200 rows | Model produces scores outside [0,1] or crashes on missing features |
| 3 | Corpus experiment (IA/LoC) | Manual search of 27 skipped scenes; ≥ 5 find usable material | — (measurement-only; any result is valid) |
| 4 | Export UI + optional Ollama concept expansion | Export works from browser; Ollama failure degrades to current behavior | Export button breaks existing CLI export |
| 5 | FFmpeg draft timeline | A playable MP4 is produced from script 35's selections | FFmpeg not installed and not documented as a requirement |
| 6 | Edge-TTS narration + SRT | A playable MP4 with audible narration and synced subtitles | TTS generation takes > 5 minutes per episode on CPU |

---

## 2. Phase 1: CLIP visual verification + duration estimate

**Phase 1 is split into two independent halves. Either can be accepted or
rejected separately. Neither blocks the other.**

### Phase 1a — Master plan document

**Deliverable:** `docs/IMPLEMENTATION_PLAN.md` (this file).

**Commit:** `docs: add phased implementation plan` (docs-only).

**Tests:** none required.

**Gate:** the file exists, is committed, and reads the same as what was
sent to the IDE.

---

### Phase 1b — Scene duration estimate

**Objective:** every scene carries an estimated narration duration; the
manifest writes it.

**Exact specification:**

1. Add `estimated_duration_seconds: float | None` to `Scene` (SQLModel).
   Backfill existing rows via `_add_missing_columns()` (existing helper).
2. Add `estimate_duration_seconds(narration: str, wpm: int = 150) -> float`
   in `backend/app/core/timing.py`:
   - `words = len(narration.split())`
   - `seconds = max(2.0, min(12.0, words / wpm * 60))`
   - Return the float.
3. Call it during scene creation in the scene splitter or wherever scenes
   are persisted (find the right hook; do not duplicate logic).
4. Manifest writer (`backend/app/export/manifest.py`) writes
   `estimated_duration_seconds` per scene.
5. Config: `NARRATION_WPM` in `config.py`, default 150, documented.

**Tests (committed in `backend/tests/test_timing.py`):**

- `test_duration_basic`: 30 words at 150 wpm → 12.0 seconds (clamped at max).
- `test_duration_minimum`: 3 words → 2.0 seconds (clamped at min).
- `test_duration_mid_range`: 100 words → 40.0 seconds.
- `test_duration_wpm_configurable`: 60 words at 100 wpm → 36.0; at 200 → 18.0.
- `test_manifest_writes_duration`: seeded scene → export → manifest JSON
  has `estimated_duration_seconds` set and non-null.

**Evidence artifact:** `docs/production/phase1b_duration_sample.json`
produced by running the export manifest script on script 35 into a temp
path. Paste the first 3 scene entries in the Phase Report, showing
`estimated_duration_seconds` populated. **Do not touch the existing
`episode-01-export-v2/` artifact.**

**Gate (PASS criteria):**

- All 5 tests pass.
- Manifest sample shows non-null durations on 3 scenes.
- Wall-clock cost of running the export manifest script: < 5 seconds
  added vs prior version. Measure with `time` and report.

**Abort condition:** none. If a test fails and can't be fixed in 3
attempts, report FAIL and stop.

**Rollback:** revert the commit. The field is additive; no downstream
code depends on it yet.

---

### Phase 1c — CLIP visual verification module

**Objective:** a module that scores (scene, candidate) pairs by CLIP
image-text similarity, with caching, feature-gated and fail-soft.

**Exact specification:**

1. **Dependency:** add `open_clip_torch` (not `clip` — maintained fork
   with better model support) and confirm `pillow` in
   `backend/requirements.txt`. Document model weights location:
   `backend/data/models/clip/`. First-run download of `ViT-B-32`
   (laion2b_s34b_b79k) is ~600 MB; document in `README.md` under an
   "Optional features" section.

2. **Module:** `backend/app/providers/ai/clip.py`
   - `_model`, `_preprocess`, `_tokenizer` — lazy-loaded, module-scoped.
   - `clip_text_embed(text: str) -> np.ndarray` — text to 512-dim vector.
   - `clip_image_embed(image_path: Path) -> np.ndarray` — image to 512-dim
     vector. Handles file-missing gracefully (returns None).
   - `clip_similarity(scene_text: str, image_path: Path) -> float` —
     cosine similarity in [-1, 1].
   - **Fail-soft:** any exception returns None; caller treats as
     "no score."

3. **Caching:** extend `EmbeddingCache` with model-versioned rows.
   - Text embeddings: key `clip-text::{sha256(scene_text)}`.
   - Image embeddings: key `clip-image::{asset_id}` (immutable per asset
     once on disk).
   - Cache read/write through existing `embedding_cache` table.
   - **No new table.**

4. **Config:** `ENABLE_CLIP_VERIFICATION` (default `False`),
   `CLIP_MODEL_NAME` (default `"ViT-B-32"`), `CLIP_RERANK_WEIGHT`
   (default `0.3`), `CLIP_TOP_N` (default `10`).

5. **Tests (`backend/tests/test_clip.py`):**
   - `test_clip_similarity_returns_float` (mocked model).
   - `test_clip_cache_hit_returns_same_vector` (call twice, assert identical).
   - `test_clip_image_missing_returns_none`.
   - `test_clip_failsoft_on_model_error` (monkeypatch `_model` to raise;
     assert None, no exception).
   - **Do NOT** write a test that requires downloading the model. All
     CLIP tests use mocks. A separate `pytest.mark.live` test is optional
     and off by default.

**Evidence artifact:** paste from `pytest backend/tests/test_clip.py -v`.
All 4 tests pass.

**Gate:** tests pass; no model download during tests; module importable
without model present.

**Abort condition:** if `open_clip_torch` can't be added to requirements
without breaking existing tests, report FAIL and stop.

---

### Phase 1d — CLIP pipeline integration

**Objective:** when `ENABLE_CLIP_VERIFICATION=True`, top-N candidates per
scene are reranked using a blend of the existing score and CLIP
similarity.

**Exact specification:**

1. New module: `backend/app/core/clip_rerank.py`
   - `rerank_with_clip(scene_narration: str, candidates: list[MediaAsset],
     top_n: int, weight: float) -> list[MediaAsset]`
   - For the first `top_n` candidates (by current served order), compute
     `clip_similarity(narration, thumbnail_path)`. Missing thumbnails →
     skip that candidate (retain current score, no CLIP contribution).
   - New score = `(1-weight)*current_score + weight * normalized_clip_score`.
   - Normalize CLIP similarity from [-1,1] to [0,1] via `(s+1)/2`.
   - Sort top-N by new score; positions below top-N unchanged.
   - Return the reordered list.

2. Wire into `fuse_and_rerank` in `core/pipeline.py` **after** the
   existing blend and **before** diversity. Guarded by
   `if config.ENABLE_CLIP_VERIFICATION`.

3. Do **not** change what `scene_to_read` serves — same read-time filter,
   same schema. Only the ordering of top-N changes when the flag is on.

**Tests (`backend/tests/test_clip_rerank.py`):**

- `test_clip_rerank_noop_when_disabled`: flag off → order identical.
- `test_clip_rerank_reorders_when_enabled`: mock CLIP scores that favor
  candidate at rank-3; assert it reaches rank-0.
- `test_clip_rerank_missing_thumbnail_is_skipped`: candidate with no
  thumbnail retains original score.
- `test_clip_rerank_weight_zero_matches_disabled`: weight=0 produces
  identical order to flag-off.
- `test_clip_rerank_failsoft`: model raises → order identical to before.

**Evidence artifact:** paste from
`pytest backend/tests/test_clip_rerank.py -v`. All 5 pass.

**Gate:** tests pass; with flag off, full test suite passes (pre-existing
tests unbroken).

**Abort condition:** if disabling the flag causes a test failure, report
FAIL.

---

### Phase 1e — CLIP measurement (the gate)

**This is the phase that decides whether Phase 1 succeeds.** Nothing
after this in Phase 1 is worth doing if this gate fails.

**Objective:** quantify the effect of CLIP reranking on the archived
pass-2 selections.

**Exact specification:**

1. **Measurement script:** `backend/scripts/measure_clip_rerank.py`
   - Args: `--archive docs/production/REVIEW_PASS_02_ARTIFACT.json`,
     `--out docs/production/clip_rerank_measurement.json`,
     `--top-n 10`, `--weight 0.3`.
   - Loads archived 32 selections.
   - For each selection, re-scores the scene's stored candidate list using
     the current pipeline (without CLIP), then with CLIP enabled on top-10.
   - Records per scene: `scene_index`, `selected_asset_id`, `rank_before`,
     `rank_after`, `clip_score_selected`, `top_clip_score`.
   - Emits a summary: rank histogram before/after, rank-0 match rate
     before/after, total CLIP inferences, total wall-clock seconds.

2. **Repeat with `--weight 0.5`** and **`--weight 0.7`** — 3 weight
   points. Each produces its own artifact:
   `clip_rerank_measurement_w030.json`,
   `clip_rerank_measurement_w050.json`,
   `clip_rerank_measurement_w070.json`.

3. **Cache behavior:** the first run downloads the model and computes all
   embeddings. Subsequent weight runs reuse the cache. Report both
   cold-run and warm-run timings.

**Evidence artifacts:**

- 3 JSON files under `docs/production/`, committed.
- Phase Report contains:
  - Baseline histograms (before).
  - Histograms at each weight (after).
  - Rank-0 match rate at each weight, both A-baseline (stored served
    order, 13/32) and B-baseline (current re-scored, 9/32) per the
    convention from the cross-encoder block.
  - Total inferences per run (~320 at weight=0.3; same across weights
    since cache reuses).
  - Cold wall-clock (model download + inference) and warm wall-clock
    per run.
  - **Ablation:** run at weight 0 with the flag on (should reproduce
    baseline — proves the harness is honest).

**Gate (PASS criteria):**

- **PRIMARY:** best rank-0 match rate across the 3 weights on
  **A-baseline** must be **≥ 15/32 (46.9%)**.
- **SECONDARY:** no weight point may produce rank-0 < 11/32 (34.4%) —
  that would indicate CLIP is actively harmful.
- Cold-run time ≤ 10 minutes total (download + inference).
- Warm-run time ≤ 3 minutes total.
- Ablation (weight=0 with flag on) exactly reproduces baseline
  (byte-identical histogram).

**Abort condition:**

- If all 3 weights produce rank-0 < 11/32, CLIP is a regression. Report
  FAIL, keep `ENABLE_CLIP_VERIFICATION=False`, and continue to Phase 2
  without enabling.
- If cold-run time > 15 minutes, report FAIL on cost grounds; the feature
  is not practical on this hardware.

**Recommendation logic:**

| Best rank-0 | Recommendation |
|---|---|
| ≥ 18/32 | PROCEED; enable default at best weight |
| 15–17/32 | PROCEED; enable feature-gated at best weight, document tradeoff |
| 13–14/32 | HOLD; flag stays off, user decides |
| 11–12/32 | HOLD; flag stays off, investigate why CLIP isn't helping |
| < 11/32 | ABORT; flag stays off, revert integration, report as failed experiment |

**Rollback if ABORT:** revert Phase 1c and 1d commits. Keep Phase 1b
(duration) — it's independent and still valuable. Record the CLIP
failure in `docs/production/RANKING_EXPERIMENTS.md` alongside the
cross-encoder result.

---

## 3. Phase 2: Cross-episode feedback model

**Objective:** learn a personalized ranking model from the accumulated
`Feedback` table and apply it as a score multiplier.

### Exact specification

1. **Module:** `backend/app/core/feedback_model.py`
   - `train_model(feedback_rows, min_rows=200) -> ModelBundle | None`
   - Model: `sklearn.linear_model.LogisticRegression` over the 6 features
     listed below.
   - Save via `joblib` to `backend/data/models/feedback_model.pkl`; save
     metadata (row count, feature list, training date, class balance, AUC
     on training) to `backend/data/models/feedback_model_meta.json`.
   - `score(scene_features, asset_features) -> float in [0.5, 2.0]` —
     P(accept) mapped to a multiplier.

2. **Features:** (compute once per (scene, asset) at inference time)
   - `semantic_score` (from MiniLM)
   - `keyword_score`
   - `provider` (one-hot: wikimedia, pixabay)
   - `media_type` (0/1)
   - `orientation` (0/1)
   - `was_in_served_top_12` (0/1)

3. **Training set construction:** from `Feedback` table, all `select`
   rows are positives, `reject` rows are negatives. Join with scene +
   asset to extract features.

4. **Config:** `ENABLE_PERSONALIZED_RANKING` (default `False`),
   `FEEDBACK_MODEL_MIN_ROWS` (default `200`).

5. **Wiring:** multiplier applied in `fuse_and_rerank` after the blend,
   before diversity. Guarded by flag + model existence + training row
   count.

6. **Neutral default:** if training rows < 200 or model file missing,
   multiplier is exactly 1.0 for all (no effect).

### Tests (`backend/tests/test_feedback_model.py`)

- `test_train_returns_none_below_threshold`
- `test_train_returns_model_above_threshold` (synthetic 250-row fixture)
- `test_score_in_range` (all outputs in [0.5, 2.0])
- `test_missing_model_is_neutral`
- `test_missing_features_does_not_crash`
- `test_holdout_auc_above_chance`: split pass-1 (train) vs pass-2 (test);
  report AUC ≥ 0.55

### Evidence artifact

`docs/production/feedback_model_measurement.json` with:
- Training rows, class balance
- Holdout AUC on pass-2
- Top-pick match rate on pass-2 archive **with and without** the model
  applied
- Training wall-clock time
- Model file size

### Gate

- All 6 tests pass.
- Holdout AUC ≥ 0.55.
- **No regression:** top-pick match rate with model ≥ without, on pass-2.
- Model file exists and its metadata JSON matches the training row count.

### Abort condition

- If AUC < 0.55 on the holdout, the model isn't learning anything. Keep
  flag off, record as failed experiment, proceed to Phase 3.
- If applying the model causes the pipeline to be > 5% slower on a full
  generation (measured), report FAIL on cost.

### Rollback

Flag stays off; the module can stay in the repo since it's already
gated. No pipeline behavior changes.

---

## 4. Phase 3: Corpus experiment

**Measurement-only phase. No implementation.**

### Exact specification

1. Load `REVIEW_PASS_02_ARTIFACT.json` and extract the 27 scenes with no
   selection.
2. For each, extract narration (first 200 chars) and the scene's concept
   expansions (if stored; if not, run `querygen` offline and take the top
   3 queries).
3. Manually search (via browser) each scene against:
   - **Internet Archive** (`archive.org/advancedsearch.php` or web UI)
   - **Library of Congress** (`loc.gov`)
   - One additional source of choice (e.g., **OldNYC**, **National
     Archives**, **Imperial War Museums**)
4. For each scene, record: found_usable (y/n), what was found (1–2 line
   description), source, why_usable (one line: "period-appropriate
   newspaper photo", "modern courthouse exterior", etc.).
5. Table in `docs/production/corpus_experiment_ia_loc.md`. 27 rows.

### Evidence artifact

The committed markdown table, plus a summary:
- Count of scenes with usable material at IA
- Count at LoC
- Count at third source
- Count with usable material at ≥ 1 source
- Overlap between sources

### Gate

- Table complete for all 27 scenes (no "unknown" rows).
- Summary counts present.
- Recommendation stated: INTEGRATE (if ≥ 5 scenes find usable material) /
  DOCUMENT CEILING (if < 5).

### Abort condition

None. Any outcome is valid. The gate is only that the work was done.

### Rollback

None — no code.

---

## 5. Phase 4: Workflow polish

### Phase 4a — Export UI trigger

**Exact specification:**

1. Backend endpoint: `POST /api/scripts/{script_id}/export` — runs the
   same code path as `backend/scripts/export_cli.py`, returns
   `{"manifest_path": "...", "scenes_downloaded": N, "scenes_skipped": M}`.
   **Simplest viable:** synchronous, but return early with
   `{"started": true, "job_id": ...}` and have the frontend poll. Reuse
   the existing `jobs` module pattern; do NOT build a new job system.

2. Frontend: an "Export manifest" button in the storyboard view header.
   On click, POST, then show a small status chip ("exporting…", "ready —
   download from `docs/production/episode-N-export-v2/manifest.json`").
   No file download dialog — just confirm the export ran and show the
   path.

3. **Do not touch the existing CLI.** Additive UI trigger only.

**Tests:**

- `test_export_endpoint_returns_manifest_path`: seed script with
  selections → POST → assert manifest exists at returned path.
- `test_export_endpoint_fails_on_no_selections`: zero selections → 400
  with clear message.

**Gate:** endpoint works via `curl`, button works in browser (verify
visually, screenshot committed to
`docs/production/phase4a_export_button.png`).

### Phase 4b — Optional Ollama concept expansion

**Exact specification:**

1. `backend/app/providers/ai/ollama.py`
   - `expand_concepts(narration: str) -> list[str]` — uses `ollama`
     python client, model `qwen2.5:1.5b-instruct-q4_K_M`.
   - Returns 3–5 additional visual-search phrases.
   - **Fail-soft:** if Ollama not running, returns `[]`, no exception,
     log once per session.

2. Wiring: in `queries_for_scene`, after existing concept expansion, if
   `ENABLE_OLLAMA_EXPANSION=True` **and** the concept map matched fewer
   than 2 concepts for this scene (the "abstract narration" signal), call
   `expand_concepts` and append results.

3. Config: `ENABLE_OLLAMA_EXPANSION` (default `False`), `OLLAMA_HOST`
   (default `http://localhost:11434`), `OLLAMA_MODEL` (default
   `qwen2.5:1.5b-instruct-q4_K_M`).

**Tests:**

- `test_ollama_returns_empty_when_unavailable` (monkeypatched failure)
- `test_ollama_expansion_used_when_low_coverage` (mock returns; assert
  extra queries generated)
- `test_ollama_not_used_when_concept_coverage_sufficient`

**Evidence:**

- `docs/production/phase4b_ollama_sample.json` — run on 5 abstract scenes
  from pass-2, showing the extra queries generated for each, with 2
  example stock-search results per query (thumbnails only).
- Wall-clock time per scene call, measured.

**Gate:** extra queries generated on the 5 abstract scenes; failure
degrades cleanly; no full-suite test breaks.

---

## 6. Phase 5: FFmpeg draft timeline

**Exact specification:**

1. **Requirement:** FFmpeg installed and on PATH. Add detection at
   script start; error message with install link if missing. Document
   in `README.md` under "Phase 5 requirements."

2. **Script:** `backend/scripts/render_draft.py`
   - Args: `--script <id>`, `--out <path.mp4>`,
     `--resolution 1920x1080`, `--fps 30`, `--ken-burns` (default on).
   - Loads selected media (per scene) from DB; skips scenes with no
     selection (`no_selection` in manifest → skip, log warning).
   - For each scene:
     - Image: `zoompan` filter, slow zoom from 105% to 100% over
       `estimated_duration_seconds`, output `fps=30`.
     - Video: trim to `estimated_duration_seconds`; if shorter, `tpad`
       to extend last frame.
   - Concatenate with `xfade` crossfade 0.3s between scenes.
   - Write draft MP4.

3. **Testing:**
   - Unit: duration math (scene duration sum ≈ output duration, tolerance
     ±1s).
   - Integration: `pytest -m long` runs the actual render on a 3-scene
     fixture (small synthetic images), produces a 5–8 second MP4.
   - **Not** run against script 35 in CI (too slow); run manually for the
     phase report.

4. **Evidence:**

   - `docs/production/phase5_draft_script35.mp4` — the rendered draft,
     30–90s. If repo policy rejects binaries that size, commit a SHA +
     external link instead.
   - `ffprobe` output pasted in the Phase Report: duration, resolution,
     fps, codec.
   - Frame extraction: `ffmpeg -ss 0.5 -i out.mp4 -frames:v 1 s1.png`,
     same at 10%, 50%, 90% — 4 PNGs committed to
     `docs/production/phase5_frames/`.
   - Total render time and output file size.

5. **Gate:** MP4 plays (verified by `ffprobe` and manual playback);
   frames show scene transitions; duration within 10% of the sum of
   `estimated_duration_seconds`.

6. **Abort condition:** if FFmpeg's `zoompan` or `xfade` filters are
   broken on this platform, report FAIL and document what didn't work.
   Do not substitute a different renderer without user approval.

---

## 7. Phase 6: Edge-TTS narration + subtitles

**Exact specification:**

1. **Dependency:** `edge-tts` (pip). Free, offline after install. Voice:
   `en-US-GuyNeural` (configurable via `TTS_VOICE`).

2. **Script:** `backend/scripts/render_with_narration.py`
   - Args: `--script <id>`, `--out <path.mp4>`,
     `--voice en-US-GuyNeural`.
   - For each scene: generate TTS audio via `edge-tts`, capture word-level
     timing via `--write-media --write-subtitles`.
   - Adjust each scene's `estimated_duration_seconds` to the actual TTS
     audio duration.
   - Render video timeline using Phase 5's `render_draft.py` logic (call
     as a library function or subprocess).
   - Mux audio stream over video stream.
   - Produce `out.mp4` and `out.srt`.

3. **SRT formatting:** one cue per scene,
   `start = cumulative_start`, `end = start + audio_duration`,
   text = narration. Optional: split into word chunks if `--word-timing`.

4. **Tests:**
   - Unit: SRT format valid (parseable, cues non-overlapping, timestamps
     ascending).
   - Integration (`pytest -m long`): render 3-scene fixture, assert audio
     stream present in MP4, assert SRT parses.

5. **Evidence:**
   - `docs/production/phase6_narrated_script35.mp4` — full rendered
     episode with audio.
   - `docs/production/phase6_script35.srt`.
   - `ffprobe` shows both video and audio streams.
   - Paste the first 5 SRT cues in the report.
   - Total generation time, TTS + render breakdown.

6. **Gate:** audio present; SRT parses and spans the full video; total
   time < 5 minutes for a 65-scene script on CPU.

7. **Abort condition:** if TTS time exceeds 10 minutes, report FAIL and
   document. If Edge-TTS is unavailable in the environment, report FAIL
   with the specific error.

---

## 8. Evidence template (every Phase Report uses this)
