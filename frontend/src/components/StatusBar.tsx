import React from 'react';
import type { BoardCounts, Issue } from '../lib/board';
import { timeAgo } from '../lib/format';

interface Props {
  counts: BoardCounts | null;
  issues: Issue[];
  lastSavedAt: string | null;
  generating: boolean;
  onNeedsPicks: () => void;
  onShowIssues: () => void;
}

/** Pinned bottom bar: board rollup, save age, issues entry point. */
export function StatusBar({ counts, issues, lastSavedAt, generating, onNeedsPicks, onShowIssues }: Props): React.ReactElement {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-subtle bg-surface/95 px-4 py-1.5 text-xs text-secondary backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        {generating && <span className="inline-block h-2 w-2 animate-pulse rounded-pill bg-accent" title="Generating" />}
        {counts ? (
          <>
            <span>
              <b>{counts.ready}/{counts.total}</b> scenes ready
            </span>
            <button
              onClick={onNeedsPicks}
              title="Filter to scenes that still need a pick"
              className="rounded-control px-1 font-semibold text-accent-text hover:bg-accent-soft"
            >
              {counts.needPicks} need picks
            </button>
            <span>{counts.rejected} rejected</span>
          </>
        ) : (
          <span className="text-tertiary">No board loaded</span>
        )}
        <span className="flex-1" />
        <span className="text-tertiary">{lastSavedAt ? `saved ${timeAgo(lastSavedAt)}` : 'unsaved'}</span>
        <button
          onClick={onShowIssues}
          disabled={issues.length === 0}
          className="rounded-control px-1 font-semibold text-warn hover:bg-warn-soft disabled:opacity-40"
        >
          {issues.length === 0 ? 'no issues ✓' : `⚠ ${issues.length} issue${issues.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </footer>
  );
}
