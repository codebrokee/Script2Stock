import React from 'react';
import type { JobProgress } from '../types';

interface Props {
  job: JobProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onPartial: () => void;
  onDismiss: () => void;
}

export function JobProgressCard({ job, onPause, onResume, onCancel, onPartial, onDismiss }: Props): React.ReactElement {
  const active = job.status === 'queued' || job.status === 'running';
  const pct =
    job.total_scenes > 0 ? Math.round((job.done_scenes / job.total_scenes) * 100) : job.status === 'running' ? 5 : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">
          {job.status === 'done' && '✅ Storyboard ready'}
          {job.status === 'error' && '❌ Generation failed'}
          {job.status === 'cancelled' && '⏹ Cancelled'}
          {active && (job.paused ? '⏸ Paused' : '⏳ Generating storyboard')}
          {job.status === 'queued' && !job.paused && '⏳ Queued'}
        </h2>
        <span className="text-xs tabular-nums text-gray-400">{job.elapsed.toFixed(0)}s elapsed</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${job.status === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
          style={{ width: `${job.status === 'done' ? 100 : pct}%` }}
        />
      </div>

      <p className="mt-2 truncate text-sm text-gray-600" title={job.stage}>
        {job.stage}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">
        {job.done_scenes}/{job.total_scenes} scenes · {job.media_found} assets found
      </p>

      {job.scenes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {[...job.scenes]
            .sort((a, b) => a.index - b.index)
            .map((s) => (
              <li key={s.index} className="flex items-center gap-2 text-xs text-gray-600">
                {s.status === 'done' && <span className="text-green-600">✓</span>}
                {s.status === 'active' && (
                  <span className={`inline-block h-2 w-2 rounded-full ${job.paused ? 'bg-yellow-500' : 'animate-pulse bg-blue-600'}`} />
                )}
                {s.status === 'pending' && <span className="text-gray-300">○</span>}
                <span>
                  Scene {s.index + 1}
                </span>
                {s.status === 'done' && <span className="text-gray-400">· {s.media} assets</span>}
              </li>
            ))}
        </ul>
      )}

      {job.status === 'error' && job.error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{job.error}</p>
      )}

      <div className="mt-3 flex gap-2">
        {active && !job.paused && (
          <button
            onClick={onPause}
            title="Pause after the current scene finishes"
            className="rounded-lg bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-800 hover:bg-yellow-200"
          >
            ⏸ Pause
          </button>
        )}
        {active && job.paused && (
          <button
            onClick={onResume}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            ▶ Resume
          </button>
        )}
        {active && (
          <button
            onClick={onCancel}
            title="Stop now — scenes finished so far are kept"
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            ⏹ Cancel
          </button>
        )}
        {job.script_id !== null && job.status !== 'done' && (
          <button
            onClick={onPartial}
            title="Use the finished scenes now — generation stays paused"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {active ? 'View partial results' : 'View partial storyboard'}
          </button>
        )}
        {!active && (
          <button
            onClick={onDismiss}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
