import React, { useState } from 'react';
import type { JobProgress } from '../types';

interface Props {
  job: JobProgress;
  /** Backend unreachable — polling paused. Red treatment with inline Retry. */
  offline: boolean;
  /** Backend restarted and forgot this job. Amber treatment. */
  gone: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onPartial: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Single-line status rail for generation jobs. Expands for the live checklist. */
export function ProgressRail({
  job,
  offline,
  gone,
  onPause,
  onResume,
  onCancel,
  onPartial,
  onRetry,
  onDismiss
}: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const active = job.status === 'queued' || job.status === 'running';
  const pct =
    job.total_scenes > 0 ? Math.round((job.done_scenes / job.total_scenes) * 100) : active ? 5 : 0;

  if (gone && !offline) {
    return (
      <div className="rounded-card border border-warn/40 bg-warn-soft p-4 shadow-card">
        <h2 className="text-sm font-bold text-warn">⚠️ Generation was interrupted</h2>
        <p className="mt-1 text-sm text-secondary">
          The backend no longer knows this job — it likely restarted. Your script text is preserved in the
          editor; click <b>Generate Scenes</b> to start over.
        </p>
        <div className="mt-3">
          <button
            onClick={onDismiss}
            className="rounded-control bg-surface px-3 py-1.5 text-xs font-semibold text-secondary ring-1 ring-border-subtle hover:bg-inset"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="rounded-card border border-danger/40 bg-danger-soft p-4 shadow-card">
        <h2 className="text-sm font-bold text-danger">⚠️ Lost connection to the backend</h2>
        <p className="mt-1 text-sm text-secondary">
          The server on <code>:8000</code> stopped responding — polling is paused, so pause/cancel can&apos;t
          reach it either. Restart it (double-click <code>start-backend.bat</code>), then retry.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetry}
            className="rounded-control bg-danger px-3 py-1.5 text-xs font-semibold text-primary hover:brightness-110"
          >
            ↻ Retry connection
          </button>
          <button
            onClick={onDismiss}
            className="rounded-control bg-surface px-3 py-1.5 text-xs font-semibold text-secondary ring-1 ring-border-subtle hover:bg-inset"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!active) {
    // Terminal states stay collapsed to a single summary line.
    const icon = job.status === 'done' ? '✅' : job.status === 'error' ? '❌' : '⏹';
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-subtle bg-surface px-4 py-2.5 text-sm shadow-card">
        <span className="font-bold text-primary">
          {icon} {job.stage}
        </span>
        <span className="text-xs text-tertiary">
          {job.done_scenes}/{job.total_scenes} scenes · {job.media_found} assets · {job.elapsed.toFixed(0)}s
        </span>
        <span className="flex-1" />
        {job.status !== 'done' && job.script_id !== null && (
          <button
            onClick={onPartial}
            className="rounded-control bg-accent px-3 py-1 text-xs font-semibold text-primary hover:bg-accent-hover"
          >
            View partial storyboard
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-control bg-elevated px-3 py-1 text-xs font-semibold text-secondary hover:bg-border-subtle"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-accent/30 bg-surface p-3 shadow-card">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse progress' : 'Expand progress'}
          className="shrink-0 rounded-control px-1 text-tertiary hover:bg-elevated hover:text-primary"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span className="shrink-0 font-bold text-primary">{job.paused ? '⏸ Paused' : '⏳ Generating'}</span>
        <span className="shrink-0 tabular-nums text-xs text-tertiary">{pct}%</span>
        {!expanded && (
          <span className="min-w-0 flex-1 truncate text-xs text-secondary" title={job.stage}>
            {job.stage}
          </span>
        )}
        <span className="flex-1" />
        {job.paused ? (
          <button
            onClick={onResume}
            className="shrink-0 rounded-control bg-success px-2.5 py-1 text-xs font-semibold text-primary hover:brightness-110"
          >
            ▶ Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            title="Pause after the current scene finishes"
            className="shrink-0 rounded-control bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn hover:bg-warn hover:text-primary"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={onCancel}
          title="Stop now — scenes finished so far are kept"
          className="shrink-0 rounded-control border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
        >
          ⏹ Cancel
        </button>
      </div>

      {expanded ? (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-pill bg-elevated">
            <div
              className="h-full rounded-pill bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 truncate text-xs text-secondary" title={job.stage}>
            {job.stage}
          </p>
          <p className="mt-0.5 text-[11px] text-tertiary">
            {job.done_scenes}/{job.total_scenes} scenes · {job.media_found} assets · {job.elapsed.toFixed(0)}s
            elapsed
          </p>
          {job.scenes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {[...job.scenes]
                .sort((a, b) => a.index - b.index)
                .map((s) => (
                  <li key={s.index} className="flex items-center gap-2 text-xs text-secondary">
                    {s.status === 'done' && <span className="text-success">✓</span>}
                    {s.status === 'active' && (
                      <span
                        className={`inline-block h-2 w-2 rounded-pill ${job.paused ? 'bg-warn' : 'animate-pulse bg-accent'}`}
                      />
                    )}
                    {s.status === 'pending' && <span className="text-tertiary">○</span>}
                    <span>Scene {s.index + 1}</span>
                    {s.status === 'done' && <span className="text-tertiary">· {s.media} assets</span>}
                  </li>
                ))}
            </ul>
          )}
          {job.script_id !== null && (
            <button
              onClick={onPartial}
              title="Use the finished scenes now — generation keeps its state"
              className="mt-2 rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent-hover"
            >
              View partial results
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
