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
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-surface px-4 py-2.5 shadow-card">
      <h1 className="min-w-0 truncate text-lg font-extrabold tracking-tight">
        🎬 Script<span className="text-accent">2</span>Stock
      </h1>
      <nav className="flex min-w-0 gap-2 overflow-x-auto rounded-card bg-elevated p-1" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onView(t.id)}
            className={`relative shrink-0 rounded-control px-3 py-1 text-sm font-semibold ${
              view === t.id ? 'bg-surface text-primary shadow-card' : 'text-secondary hover:text-primary'
            }`}
          >
            {t.label}
            {t.id === 'storyboard' && dirty && (
              <span title="Unsaved changes" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-pill bg-warn" />
            )}
          </button>
        ))}
      </nav>
      <span className="min-w-0 flex-1" />
      <button
        onClick={onPalette}
        title="Command palette"
        className="hidden shrink-0 rounded-control border border-subtle px-2 py-1 text-xs text-tertiary hover:bg-inset sm:block"
      >
        ⌘K
      </button>
      <button
        onClick={onSave}
        disabled={!canSave}
        className="shrink-0 rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-40 hover:bg-accent-hover"
      >
        Save{dirty ? ' ●' : ''}
      </button>
      <button
        onClick={onExport}
        disabled={!canSave}
        className="shrink-0 rounded-control bg-elevated px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-border-subtle disabled:opacity-40 hover:bg-border-subtle"
      >
        Export
      </button>
    </header>
  );
}
