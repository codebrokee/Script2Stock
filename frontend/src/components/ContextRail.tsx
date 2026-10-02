import React from 'react';
import type { SavedStoryboardMeta, Scene } from '../types';
import { sceneStatus, type SceneFilter, type SceneStatus } from '../lib/board';

export type RailMode = 'editor' | 'board' | 'library';
export type SavedSort = 'newest' | 'oldest' | 'title';

const DOT: Record<SceneStatus, string> = {
  done: 'bg-success',
  'needs-pick': 'bg-accent',
  pending: 'bg-gray-300',
  error: 'bg-danger'
};

const FILTERS: Array<{ id: SceneFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs-pick', label: 'Needs pick' },
  { id: 'done', label: 'Done' },
  { id: 'rejected', label: 'Rejected' }
];

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mode: RailMode;
  onMode: (m: RailMode) => void;
  // editor pane
  title: string;
  text: string;
  onTitle: (v: string) => void;
  onText: (v: string) => void;
  generateDisabled: boolean;
  generateLabel: string;
  onGenerate: () => void;
  // board pane
  scenes: Scene[];
  filter: SceneFilter;
  onFilter: (f: SceneFilter) => void;
  compactAll: boolean;
  onCompactAll: (v: boolean) => void;
  onJumpScene: (sceneId: number) => void;
  // library pane
  saved: SavedStoryboardMeta[];
  savedQuery: string;
  onSavedQuery: (v: string) => void;
  savedSort: SavedSort;
  onSavedSort: (s: SavedSort) => void;
  onLoadSaved: (id: number) => void;
}

const MODES: Array<{ id: RailMode; label: string; icon: string }> = [
  { id: 'editor', label: 'Editor', icon: '✎' },
  { id: 'board', label: 'Board', icon: '▦' },
  { id: 'library', label: 'Library', icon: '📚' }
];

export function ContextRail(props: Props): React.ReactElement {
  const { collapsed, onToggleCollapse, mode, onMode } = props;

  if (collapsed) {
    return (
      <div className="flex w-12 flex-col items-center gap-1 rounded-xl border bg-white p-2 shadow-sm">
        <button
          onClick={onToggleCollapse}
          title="Expand panel"
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
        >
          »
        </button>
        {MODES.map((m) => (
          <button
            key={m.id}
            title={m.label}
            onClick={() => {
              onMode(m.id);
              onToggleCollapse();
            }}
            className={`rounded p-1.5 text-base hover:bg-gray-100 ${mode === m.id ? 'bg-accent-soft' : ''}`}
          >
            {m.icon}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-[280px] rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onMode(m.id)}
            title={m.label}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
              mode === m.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
        <button
          onClick={onToggleCollapse}
          title="Collapse panel"
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
        >
          «
        </button>
      </div>
      {mode === 'editor' && <EditorPane {...props} />}
      {mode === 'board' && <BoardPane {...props} />}
      {mode === 'library' && <LibraryPane {...props} />}
    </div>
  );
}

function EditorPane(p: Props): React.ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">Title</label>
      <input
        value={p.title}
        onChange={(e) => p.onTitle(e.target.value)}
        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">YouTube script</label>
      <textarea
        value={p.text}
        onChange={(e) => p.onText(e.target.value)}
        rows={14}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
      />
      <button
        onClick={p.onGenerate}
        disabled={p.generateDisabled}
        className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40 hover:bg-blue-700"
      >
        {p.generateLabel}
      </button>
      <p className="mt-2 text-[11px] text-gray-400">
        Scenes split on sentences (1–3 per scene, ~15–40 words). Paragraph breaks force boundaries.
      </p>
    </div>
  );
}

function BoardPane(p: Props): React.ReactElement {
  if (p.scenes.length === 0) {
    return <p className="text-xs text-gray-400">No board loaded — generate a script or load a saved board.</p>;
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => p.onFilter(f.id)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p.filter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={p.compactAll} onChange={(e) => p.onCompactAll(e.target.checked)} />
        Compact cards
      </label>
      <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
        {p.scenes.map((s) => {
          const st = sceneStatus(s);
          const picks = s.media.filter((m) => m.status === 'selected').length;
          return (
            <li key={s.id}>
              <button
                onClick={() => p.onJumpScene(s.id)}
                title={s.narration}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[st]}`} />
                <span className="shrink-0 text-[11px] font-bold text-gray-400">{s.index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{s.narration}</span>
                {picks > 0 && <span className="shrink-0 text-[11px] text-success-strong">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LibraryPane(p: Props): React.ReactElement {
  const q = p.savedQuery.trim().toLowerCase();
  const items = p.saved
    .filter((s) => (q ? s.title.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      if (p.savedSort === 'title') return a.title.localeCompare(b.title);
      if (p.savedSort === 'oldest') return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
  return (
    <div>
      <input
        value={p.savedQuery}
        onChange={(e) => p.onSavedQuery(e.target.value)}
        placeholder="Filter saved…"
        className="mb-2 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
      />
      <select
        value={p.savedSort}
        onChange={(e) => p.onSavedSort(e.target.value as SavedSort)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="title">By title</option>
      </select>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Nothing saved yet — use “Save Storyboard” up top.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-700" title={s.title}>
                  {s.title}
                </span>
                <span className="text-[11px] text-gray-400">
                  {s.scene_count} scenes · {new Date(s.created_at).toLocaleString()}
                </span>
              </span>
              <button
                onClick={() => p.onLoadSaved(s.id)}
                className="shrink-0 rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-200"
              >
                Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
