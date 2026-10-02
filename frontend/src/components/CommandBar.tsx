import React from 'react';

export type ViewMode = 'editor' | 'storyboard' | 'library';

interface Props {
  view: ViewMode;
  onView: (v: ViewMode) => void;
  dirty: boolean;
  canSave: boolean;
  onSave: () => void;
  onExport: () => void;
  onPalette: () => void;
}

const TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'editor', label: '✎ Editor' },
  { id: 'storyboard', label: '▦ Storyboard' },
  { id: 'library', label: '📚 Library' }
];

export function CommandBar({ view, onView, dirty, canSave, onSave, onExport, onPalette }: Props): React.ReactElement {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-2.5 shadow-sm">
      <h1 className="text-lg font-extrabold tracking-tight">
        🎬 Script<span className="text-blue-600">2</span>Stock
      </h1>
      <nav className="flex gap-1 rounded-xl bg-gray-100 p-1" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onView(t.id)}
            className={`relative rounded-lg px-3 py-1 text-sm font-semibold ${
              view === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
            {t.id === 'storyboard' && dirty && (
              <span title="Unsaved changes" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warn" />
            )}
          </button>
        ))}
      </nav>
      <span className="flex-1" />
      <button
        onClick={onPalette}
        title="Command palette"
        className="hidden rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 sm:block"
      >
        ⌘K
      </button>
      <button
        onClick={onSave}
        disabled={!canSave}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-blue-700"
      >
        Save{dirty ? ' ●' : ''}
      </button>
      <button
        onClick={onExport}
        disabled={!canSave}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Export
      </button>
    </header>
  );
}
