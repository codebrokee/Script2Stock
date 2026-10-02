import React, { useEffect, useRef, useState } from 'react';

export interface ToastData {
  kind: 'error' | 'notice';
  text: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;
const EXIT_MS = 200;

/** Self-timed toast: enters with animation, auto-dismisses after 6s with an
 *  exit animation, or closes early via ✕. */
export function Toast({ kind, text, onDismiss }: ToastData): React.ReactElement {
  const [leaving, setLeaving] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => dismissRef.current(), EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  const style =
    kind === 'error'
      ? 'border-danger/30 bg-danger-soft text-danger'
      : 'border-success/30 bg-success-soft text-success';
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-card border bg-surface px-3 py-2 text-sm shadow-lift ${style} ${
        leaving ? 'toast-exit' : 'toast-enter'
      }`}
    >
      <span className="flex-1 break-words">{text}</span>
      <button
        onClick={() => setLeaving(true)}
        aria-label="Dismiss"
        className="rounded px-1 text-xs opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
