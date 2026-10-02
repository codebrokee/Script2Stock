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
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <h2 className="text-sm font-bold text-gray-800">Unsaved changes on “{currentTitle}”</h2>
        <p className="mt-1 text-sm text-gray-600">Save before loading “{otherTitle}”?</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={onSaveLoad}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            Save &amp; load
          </button>
          <button
            onClick={onDiscardLoad}
            className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
          >
            Discard &amp; load
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
