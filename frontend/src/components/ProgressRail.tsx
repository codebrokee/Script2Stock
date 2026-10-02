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
      <div className="rounded-xl border border-warn/40 bg-warn-soft p-4 shadow-sm">
        <h2 className="text-sm font-bold text-warn-strong">⚠️ Generation was interrupted</h2>
        <p className="mt-1 text-sm text-gray-600">
          The backend no longer knows this job — it likely restarted. Your script text is preserved in the
          editor; click <b>Generate Scenes</b> to start over.
        </p>
        <div className="mt-3">
          <button
            onClick={onDismiss}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger-soft p-4 shadow-sm">
        <h2 className="text-sm font-bold text-danger-strong">⚠️ Lost connection to the backend</h2>
        <p className="mt-1 text-sm text-gray-600">
          The server on <code>:8000</code> stopped responding — polling is paused, so pause/cancel can&apos;t
          reach it either. Restart it (double-click <code>start-backend.bat</code>), then retry.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onRetry}
            className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-strong"
          >
            ↻ Retry connection
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm">
        <span className="font-bold text-gray-800">
          {icon} {job.stage}
        </span>
        <span className="text-xs text-gray-400">
          {job.done_scenes}/{job.total_scenes} scenes · {job.media_found} assets · {job.elapsed.toFixed(0)}s
        </span>
        <span className="flex-1" />
        {job.status !== 'done' && job.script_id !== null && (
          <button
            onClick={onPartial}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            View partial storyboard
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse progress' : 'Expand progress'}
          className="rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <span className="font-bold text-gray-800">{job.paused ? '⏸ Paused' : '⏳ Generating'}</span>
        <span className="tabular-nums text-xs text-gray-400">{pct}%</span>
        {!expanded && (
          <span className="truncate text-xs text-gray-500" title={job.stage}>
            {job.stage}
          </span>
        )}
        <span className="flex-1" />
        {job.paused ? (
          <button
            onClick={onResume}
            className="rounded-lg bg-success px-2.5 py-1 text-xs font-semibold text-white hover:bg-success-strong"
          >
            ▶ Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            title="Pause after the current scene finishes"
            className="rounded-lg bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn-strong hover:bg-warn hover:text-white"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={onCancel}
          title="Stop now — scenes finished so far are kept"
          className="rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
        >
          ⏹ Cancel
        </button>
      </div>

      {expanded ? (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 truncate text-xs text-gray-600" title={job.stage}>
            {job.stage}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {job.done_scenes}/{job.total_scenes} scenes · {job.media_found} assets · {job.elapsed.toFixed(0)}s
            elapsed
          </p>
          {job.scenes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {[...job.scenes]
                .sort((a, b) => a.index - b.index)
                .map((s) => (
                  <li key={s.index} className="flex items-center gap-2 text-xs text-gray-600">
                    {s.status === 'done' && <span className="text-success">✓</span>}
                    {s.status === 'active' && (
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${job.paused ? 'bg-warn' : 'animate-pulse bg-accent'}`}
                      />
                    )}
                    {s.status === 'pending' && <span className="text-gray-300">○</span>}
                    <span>Scene {s.index + 1}</span>
                    {s.status === 'done' && <span className="text-gray-400">· {s.media} assets</span>}
                  </li>
                ))}
            </ul>
          )}
          {job.script_id !== null && (
            <button
              onClick={onPartial}
              title="Use the finished scenes now — generation keeps its state"
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong"
            >
              View partial results
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
