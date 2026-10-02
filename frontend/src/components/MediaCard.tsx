import React from 'react';
import type { MediaAsset } from '../types';
import { aspectLabel, formatDuration } from '../lib/format';
import { LicenseBadge } from './LicenseBadge';

interface Props {
  asset: MediaAsset;
  onUse: (a: MediaAsset) => void;
  onReject: (a: MediaAsset) => void;
  onSimilar: (a: MediaAsset) => void;
  /** Restore a rejected card to candidate. Session-local: no backend endpoint resets status. */
  onUndo?: (a: MediaAsset) => void;
  loading?: boolean;
  focused?: boolean;
  onFocus?: (a: MediaAsset) => void;
}

export function MediaCard({ asset, onUse, onReject, onSimilar, onUndo, loading, focused, onFocus }: Props): React.ReactElement {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-gray-200">
        <div className="aspect-video w-full animate-pulse bg-gray-200" />
        <div className="space-y-2 p-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const status = asset.status;
  const thumb = asset.cached_thumbnail || asset.thumbnail_url;
  const frame =
    status === 'selected'
      ? 'border-2 border-success bg-success-soft'
      : status === 'rejected'
        ? 'border border-gray-200 opacity-70'
        : 'border border-gray-200 hover:border-accent hover:bg-accent-soft/50';
  const ratio = aspectLabel(asset.width, asset.height);
  const dur = asset.media_type === 'video' ? formatDuration(asset.duration) : '';
  const lowRes = asset.width > 0 && asset.width < 1280;

  return (
    <div
      id={`media-${asset.id}`}
      className={`relative scroll-mt-28 overflow-hidden rounded-xl bg-surface shadow-sm transition ${frame} ${
        focused ? 'ring-2 ring-accent' : ''
      }`}
    >
      {status === 'selected' && (
        <span className="absolute right-0 top-2 z-10 rounded-l bg-success px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
          SELECTED
        </span>
      )}
      <button
        type="button"
        onClick={() => onFocus?.(asset)}
        title="Inspect (opens details)"
        className="relative block aspect-video w-full cursor-zoom-in bg-gray-100 text-left"
      >
        {thumb ? (
          <img
            src={thumb}
            alt={asset.title}
            loading="lazy"
            className={`h-full w-full object-cover ${status === 'rejected' ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">no preview</div>
        )}
        {status === 'rejected' && (
          <div aria-hidden className="absolute left-[-10%] right-[-10%] top-1/2 h-0.5 -rotate-6 bg-danger/70" />
        )}
        <div className="absolute bottom-1 left-1 flex gap-1">
          {ratio && (
            <span className="rounded bg-black/70 px-1 py-px text-[10px] font-semibold text-white">{ratio}</span>
          )}
          {dur && (
            <span className="rounded bg-black/70 px-1 py-px text-[10px] font-semibold text-white">{dur}</span>
          )}
          {lowRes && (
            <span className="rounded bg-warn px-1 py-px text-[10px] font-semibold text-white">low-res</span>
          )}
        </div>
      </button>
      <div className="space-y-1 p-2">
        <div className="truncate text-xs font-medium" title={asset.title}>
          {asset.title || `${asset.provider} ${asset.provider_id}`}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="truncate">{asset.provider}</span>
          <span>·</span>
          <span>{asset.media_type}</span>
          {asset.width > 0 && (
            <>
              <span>·</span>
              <span>
                {asset.width}x{asset.height}
              </span>
            </>
          )}
        </div>
        <LicenseBadge license={asset.license} />
        {status === 'rejected' ? (
          onUndo && (
            <button
              onClick={() => onUndo(asset)}
              className="mt-1 w-full rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200"
            >
              ↩ Undo reject
            </button>
          )
        ) : (
          <div className="flex gap-1 pt-1">
            <button
              onClick={() => onUse(asset)}
              className="flex-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
            >
              Use
            </button>
            <button
              onClick={() => onReject(asset)}
              className="flex-1 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Reject
            </button>
            <button
              onClick={() => onSimilar(asset)}
              title="Find Similar"
              className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
            >
              ✨
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
