import React from 'react';
import type { Issue } from '../lib/board';

interface Props {
  open: boolean;
  issues: Issue[];
  onClose: () => void;
}

/** Right slide-over listing board warnings and errors. */
export function IssuesDrawer({ open, issues, onClose }: Props): React.ReactElement | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-label="Issues">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-80 max-w-[90vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold text-gray-800">Issues ({issues.length})</h2>
          <button
            onClick={onClose}
            aria-label="Close issues"
            className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {issues.length === 0 && <li className="text-sm text-gray-400">All clear ✓</li>}
          {issues.map((iss, i) => (
            <li
              key={i}
              className={`rounded-lg border px-3 py-2 text-sm ${
                iss.kind === 'error' ? 'border-danger/30 bg-danger-soft text-danger-strong' : 'border-warn/30 bg-warn-soft text-warn-strong'
              }`}
            >
              {iss.kind === 'error' ? '❌ ' : '⚠️ '}
              {iss.text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
