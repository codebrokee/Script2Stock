import React from 'react';
import { FadeImg } from './FadeImg';
import type { SavedStoryboardMeta, Storyboard } from '../types';

interface Props {
  saved: SavedStoryboardMeta[];
  previews: Record<number, Storyboard>;
  onOpen: (id: number) => void;
}

/** Full-page library grid. Thumbnails fill in as previews load; clicking a card
 *  opens the preview drawer — the current board stays put until you hit Open. */
export function LibraryGrid({ saved, previews, onOpen }: Props): React.ReactElement {
  if (saved.length === 0) {
    return (
      <div className="rounded-card border border-dashed bg-surface p-10 text-center text-sm text-tertiary">
        No saved storyboards yet. Generate a board, then click <b>Save</b> up top.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {saved.map((s) => {
        const scenes = previews[s.id]?.scenes ?? [];
        const thumbs = scenes
          .slice(0, 4)
          .map((sc) => sc.media.find((m) => m.status !== 'rejected') ?? sc.media[0])
          .filter((m): m is NonNullable<typeof m> => !!m);
        return (
          <article key={s.id} className="overflow-hidden rounded-card border border-subtle bg-surface shadow-card">
            <button onClick={() => onOpen(s.id)} className="block w-full text-left" title="Preview">
              {thumbs.length > 0 ? (
                <div className="grid h-24 grid-cols-4 gap-2 bg-elevated p-2">
                  {thumbs.map((m) => {
                    const src = m.cached_thumbnail || m.thumbnail_url;
                    return src ? (
                      <FadeImg key={m.id} src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div key={m.id} className="h-full w-full bg-elevated" />
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center bg-inset text-xs text-tertiary">
                  loading preview…
                </div>
              )}
            </button>
            <div className="p-4">
              <h3 className="truncate text-sm font-bold text-primary" title={s.title}>
                {s.title}
              </h3>
              <p className="mt-0.5 text-xs text-tertiary">
                {s.scene_count} scenes · {new Date(s.created_at).toLocaleString()}
              </p>
              <button
                onClick={() => onOpen(s.id)}
                className="mt-3 w-full rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent-hover"
              >
                Preview
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
