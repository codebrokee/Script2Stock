import React from 'react';
import type { SavedStoryboardMeta, Storyboard } from '../types';

interface Props {
  meta: SavedStoryboardMeta | null;
  preview: Storyboard | null;
  onClose: () => void;
  onOpen: (id: number) => void;
}

/** Peek at a saved board without leaving the current one. Explicit Open to switch. */
export function BoardPreviewDrawer({ meta, preview, onClose, onOpen }: Props): React.ReactElement | null {
  if (!meta) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="Board preview">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-96 max-w-[92vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="truncate text-sm font-bold text-gray-800">{meta.title}</h2>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <p className="text-xs text-gray-400">
            {meta.scene_count} scenes · {new Date(meta.created_at).toLocaleString()}
          </p>
          {!preview && <p className="text-sm text-gray-400">Loading preview…</p>}
          {preview?.scenes.map((s) => {
            const first = s.media.find((m) => m.status !== 'rejected') ?? s.media[0];
            const src = first ? first.cached_thumbnail || first.thumbnail_url : '';
            return (
              <div key={s.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                {src ? (
                  <img src={src} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded bg-gray-200" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-600">Scene {s.index + 1}</p>
                  <p className="truncate text-xs text-gray-500">{s.narration}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t p-3">
          <button
            onClick={() => onOpen(meta.id)}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-bold text-white hover:bg-accent-strong"
          >
            Open this board
          </button>
        </div>
      </aside>
    </div>
  );
}
