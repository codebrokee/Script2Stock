import React from 'react';
import type { SavedStoryboardMeta } from '../types';

interface Props {
  saved: SavedStoryboardMeta[];
  onOpen: (id: number) => void;
}

/** Simple full-page library grid (enriched with previews in a later stage). */
export function LibraryGrid({ saved, onOpen }: Props): React.ReactElement {
  if (saved.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-gray-400">
        No saved storyboards yet. Generate a board, then click <b>Save</b> up top.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {saved.map((s) => (
        <article key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="truncate text-sm font-bold text-gray-800" title={s.title}>
            {s.title}
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            {s.scene_count} scenes · {new Date(s.created_at).toLocaleString()}
          </p>
          <button
            onClick={() => onOpen(s.id)}
            className="mt-3 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong"
          >
            Open
          </button>
        </article>
      ))}
    </div>
  );
}
