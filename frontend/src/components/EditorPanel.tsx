import React from 'react';

interface Props {
  title: string;
  text: string;
  onTitle: (v: string) => void;
  onText: (v: string) => void;
  generateDisabled: boolean;
  generateLabel: string;
  onGenerate: () => void;
  rows?: number;
  /** Render without the card wrapper (for embedding inside another panel). */
  bare?: boolean;
}

/** Script editor form, shared by the rail and the full-page editor view. */
export function EditorPanel(p: Props): React.ReactElement {
  const body = (
    <>
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
        rows={p.rows ?? 14}
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
    </>
  );
  if (p.bare) return body;
  return <div className="rounded-xl border bg-white p-4 shadow-sm">{body}</div>;
}
