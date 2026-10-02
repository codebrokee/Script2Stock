import React, { useState } from 'react';
import type { MediaAsset, Scene } from '../types';
import { sceneStatus, type SceneStatus } from '../lib/board';
import { MediaCard } from './MediaCard';

const PILL: Record<SceneStatus, string> = {
  done: 'bg-success-soft text-success-strong',
  'needs-pick': 'bg-accent-soft text-accent-strong',
  pending: 'bg-gray-100 text-gray-500',
  error: 'bg-danger-soft text-danger-strong'
};

const PILL_LABEL: Record<SceneStatus, string> = {
  done: 'Ready ✓',
  'needs-pick': 'Needs pick',
  pending: 'No media',
  error: 'Needs attention'
};

interface Props {
  scene: Scene;
  onStatus: (sceneId: number, asset: MediaAsset, action: 'select' | 'reject') => void;
  onManualSearch: (sceneId: number, q: string) => Promise<void>;
  onSimilar: (scene: Scene, asset: MediaAsset) => void;
  onRestore?: (sceneId: number, asset: MediaAsset) => void;
  searching: boolean;
}

export function SceneCard({ scene, onStatus, onManualSearch, onSimilar, onRestore, searching }: Props): React.ReactElement {
  const [q, setQ] = useState<string>('');
  const [showRejected, setShowRejected] = useState(false);
  const status = sceneStatus(scene);
  const visible = scene.media.filter((m) => m.status !== 'rejected');
  const rejected = scene.media.filter((m) => m.status === 'rejected');

  return (
    <article id={`scene-${scene.id}`} className="scroll-mt-24 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800">Scene {scene.index + 1}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL[status]}`}>
            {PILL_LABEL[status]}
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          chars {scene.start_char}–{scene.end_char}
        </span>
      </header>
      <p className="mb-2 text-sm leading-relaxed text-gray-700">{scene.narration}</p>
      {scene.queries.length > 0 && (
        <p className="mb-2 truncate text-[11px] text-gray-400" title={scene.queries.join(' · ')}>
          queries: {scene.queries.join(' · ')}
        </p>
      )}
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) void onManualSearch(scene.id, q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Manual search across all providers…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching || !q.trim()}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>
      {visible.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500">
          No media found — try manual search
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((m) => (
            <MediaCard
              key={m.id}
              asset={m}
              onUse={(a) => onStatus(scene.id, a, 'select')}
              onReject={(a) => onStatus(scene.id, a, 'reject')}
              onSimilar={(a) => onSimilar(scene, a)}
            />
          ))}
        </div>
      )}
      {rejected.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowRejected((v) => !v)}
            className="text-[11px] font-semibold text-gray-400 hover:text-gray-600"
          >
            {showRejected ? '▾' : '▸'} Rejected ({rejected.length})
          </button>
          {showRejected && (
            <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {rejected.map((m) => (
                <MediaCard
                  key={m.id}
                  asset={m}
                  onUse={(a) => onStatus(scene.id, a, 'select')}
                  onReject={(a) => onStatus(scene.id, a, 'reject')}
                  onSimilar={(a) => onSimilar(scene, a)}
                  onUndo={onRestore ? (a) => onRestore(scene.id, a) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
