import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  actions: PaletteAction[];
  onClose: () => void;
}

/** Minimal hand-rolled command palette: filter, arrows, Enter, Esc. */
export function CommandPalette({ open, actions, onClose }: Props): React.ReactElement | null {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open ]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? actions.filter((a) => a.label.toLowerCase().includes(needle)) : actions;
  }, [actions, q]);

  useEffect(() => setSel(0), [q ]);

  if (!open) return null;

  function choose(i: number): void {
    const a = items[i];
    if (a) {
      onClose();
      a.run();
    }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-24 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-2xl">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((s) => (s + 1) % Math.max(1, items.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((s) => (s - 1 + items.length) % Math.max(1, items.length));
            } else if (e.key === 'Enter') {
              choose(sel);
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder="Type a command…"
          className="w-full border-b px-4 py-3 text-sm focus:outline-none"
        />
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {items.map((a, i) => (
            <li key={a.id}>
              <button
                onClick={() => choose(i)}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  i === sel ? 'bg-accent-soft text-accent-strong' : 'text-gray-700'
                }`}
              >
                <span className="flex-1">{a.label}</span>
                {a.hint && <span className="text-[11px] text-gray-400">{a.hint}</span>}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-400">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
