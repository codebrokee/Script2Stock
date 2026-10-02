import React from 'react';

interface Props {
  open: boolean;
  currentTitle: string;
  otherTitle: string;
  onSaveLoad: () => void;
  onDiscardLoad: () => void;
  onCancel: () => void;
}

/** Dirty-guard for switching boards with unsaved changes. */
export function ConfirmDialog({ open, currentTitle, otherTitle, onSaveLoad, onDiscardLoad, onCancel }: Props): React.ReactElement | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="alertdialog" aria-label="Unsaved changes">
      {/* [overlay] dim backdrop; pure black keeps photos legible behind drawers */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-card bg-surface p-5 shadow-lift">
        <h2 className="text-sm font-bold text-primary">Unsaved changes on “{currentTitle}”</h2>
        <p className="mt-1 text-sm text-secondary">Save before loading “{otherTitle}”?</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onSaveLoad}
            className="rounded-control bg-accent px-3 py-2 text-sm font-semibold text-primary hover:bg-accent-hover"
          >
            Save &amp; load
          </button>
          <button
            onClick={onDiscardLoad}
            className="rounded-control bg-danger-soft px-3 py-2 text-sm font-semibold text-danger hover:brightness-125"
          >
            Discard &amp; load
          </button>
          <button
            onClick={onCancel}
            className="rounded-control bg-elevated px-3 py-2 text-sm font-semibold text-secondary hover:bg-border-subtle"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
