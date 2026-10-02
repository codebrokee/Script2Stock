"""Eval CLI: run from backend/ as ``python -m tests.run_eval --layer <name>``.

Evaluates the current pipeline against the golden scenes, appends a row to
results.csv, and fails (exit 1) if precision_at_k or hit_rate regressed
more than 5% versus the previous row.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import eval as E  # noqa: E402
from app.core import pipeline  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--layer", required=True, help="e.g. baseline, L1, L2 ...")
    args = ap.parse_args()

    scenes = E.load_scenes()
    metrics = E.evaluate(pipeline.rank_scene, scenes)
    ok, msg = E.append_row(args.layer, metrics)

    print(f"layer={args.layer} scenes={len(scenes)}")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
    print(f"gate: {'PASS' if ok else 'FAIL'} — {msg}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
