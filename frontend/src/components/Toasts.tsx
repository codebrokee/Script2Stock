import React from 'react';

export interface ToastData {
  kind: 'error' | 'notice';
  text: string;
  onDismiss: () => void;
}

export function Toast({ kind, text, onDismiss }: ToastData): React.ReactElement {
  const style =
    kind === 'error'
      ? 'border-danger/30 bg-danger-soft text-danger'
      : 'border-success/30 bg-success-soft text-success';
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-card border bg-surface px-3 py-2 text-sm shadow-lift ${style}`}
    >
      <span className="flex-1">{text}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-control px-1 text-xs opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
