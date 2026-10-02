import React, { useState } from 'react';
import type { MediaAsset, Scene } from '../types';
import { sceneStatus, type SceneStatus } from '../lib/board';
import { MediaCard, MediaCardSkeleton } from './MediaCard';

const PILL: Record<SceneStatus, string> = {
  done: 'bg-success-soft text-success',
  'needs-pick': 'bg-accent-soft text-accent-text',
  pending: 'bg-elevated text-secondary',
  error: 'bg-danger-soft text-danger'
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
  compact?: boolean;
  focusedAssetId?: number | null;
  onFocusAsset?: (sceneId: number, asset: MediaAsset) => void;
}

export function SceneCard({ scene, onStatus, onManualSearch, onSimilar, onRestore, searching, compact, focusedAssetId, onFocusAsset }: Props): React.ReactElement {
  const [q, setQ] = useState<string>('');
  const [showRejected, setShowRejected] = useState(false);
  const status = sceneStatus(scene);
  const visible = scene.media.filter((m) => m.status !== 'rejected');
  const rejected = scene.media.filter((m) => m.status === 'rejected');

  return (
    <article
      id={`scene-${scene.id}`}
      className={`scroll-mt-24 rounded-card border border-subtle bg-inset shadow-card ${compact ? 'p-2' : 'p-4'}`}
    >
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="shrink-0 text-sm font-bold text-primary">Scene {scene.index + 1}</h3>
          <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${PILL[status]}`}>
            {PILL_LABEL[status]}
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-tertiary">
          chars {scene.start_char}–{scene.end_char}
        </span>
      </header>
      <p className={`mb-2 leading-relaxed text-primary ${compact ? 'line-clamp-2 text-[13px]' : 'text-sm'}`}>{scene.narration}</p>
      {!compact && scene.queries.length > 0 && (
        <p className="mb-2 truncate text-[11px] text-tertiary" title={scene.queries.join(' · ')}>
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
          className="min-w-0 flex-1 rounded-control border border-subtle bg-inset px-3 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching || !q.trim()}
          className="shrink-0 rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-40"
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>
      {searching && (
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4" aria-label="Searching media">
          {[0, 1, 2, 3].map((i) => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>
      )}
      {visible.length === 0 && !searching ? (
        <p className="rounded-control bg-surface p-4 text-center text-sm text-secondary">
          No media found — try manual search
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((m) => (
            <MediaCard
              key={m.id}
              asset={m}
              focused={focusedAssetId === m.id}
              onFocus={(a) => onFocusAsset?.(scene.id, a)}
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
            className="text-[11px] font-semibold text-tertiary hover:text-primary"
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
