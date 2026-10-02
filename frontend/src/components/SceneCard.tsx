import React, { useState } from 'react';
import type { MediaAsset, Scene } from '../types';
import { MediaCard } from './MediaCard';

interface Props {
  scene: Scene;
  onStatus: (sceneId: number, asset: MediaAsset, action: 'select' | 'reject') => void;
  onManualSearch: (sceneId: number, q: string) => Promise<void>;
  onSimilar: (scene: Scene, asset: MediaAsset) => void;
  searching: boolean;
}

export function SceneCard({ scene, onStatus, onManualSearch, onSimilar, searching }: Props): React.ReactElement {
  const [q, setQ] = useState<string>('');
  const visible = scene.media.filter((m) => m.status !== 'rejected');
  const rejectedCount = scene.media.length - visible.length;

  return (
    <article className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <header className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-800">Scene {scene.index + 1}</h3>
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
      {rejectedCount > 0 && <p className="mt-1 text-[11px] text-gray-400">{rejectedCount} rejected (hidden)</p>}
    </article>
  );
}
