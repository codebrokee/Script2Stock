import React from 'react';
import type { MediaAsset } from '../types';
import { aspectLabel, formatDuration } from '../lib/format';
import { FadeImg } from './FadeImg';
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

export function MediaCardSkeleton(): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-border-subtle" aria-hidden>
      <div className="aspect-video w-full animate-pulse bg-elevated" />
      <div className="space-y-2 p-2">
        <div className="h-3 w-3/4 animate-pulse rounded-control bg-elevated" />
        <div className="h-3 w-1/2 animate-pulse rounded-control bg-elevated" />
      </div>
    </div>
  );
}

export function MediaCard({ asset, onUse, onReject, onSimilar, onUndo, loading, focused, onFocus }: Props): React.ReactElement {
  if (loading) {
    return <MediaCardSkeleton />;
  }

  const status = asset.status;
  const thumb = asset.cached_thumbnail || asset.thumbnail_url;
  const frame =
    status === 'selected'
      ? 'border-2 border-success bg-success-soft'
      : status === 'rejected'
        ? 'border border-subtle opacity-70'
        : 'border border-subtle hover:border-accent hover:bg-accent-soft/50';
  const ratio = aspectLabel(asset.width, asset.height);
  const dur = asset.media_type === 'video' ? formatDuration(asset.duration) : '';
  const lowRes = asset.width > 0 && asset.width < 1280;

  return (
    <div
      id={`media-${asset.id}`}
      className={`relative scroll-mt-28 overflow-hidden rounded-card bg-surface shadow-card transition hover:-translate-y-px hover:shadow-lift ${frame} ${
        focused ? 'ring-2 ring-accent' : ''
      }`}
    >
      {status === 'selected' && (
        <span className="absolute right-0 top-2 z-10 rounded-l-control bg-success px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary">
          SELECTED
        </span>
      )}
      <button
        type="button"
        onClick={() => onFocus?.(asset)}
        title="Inspect (opens details)"
        className="relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-md bg-bg-inset text-left"
      >
        {thumb ? (
          <FadeImg
            src={thumb}
            alt={asset.title}
            className={`h-full w-full object-cover ${status === 'rejected' ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-tertiary">no preview</div>
        )}
        {status === 'rejected' && (
          <div aria-hidden className="absolute left-[-10%] right-[-10%] top-1/2 h-0.5 -rotate-6 bg-danger/70" />
        )}
        {/* [overlay] pure-black pills stay readable over any photo */}
        <div className="absolute bottom-1 left-1 flex gap-1">
          {ratio && (
            <span className="rounded-control bg-black/70 px-1 py-px text-[10px] font-semibold text-primary">{ratio}</span>
          )}
          {dur && (
            <span className="rounded-control bg-black/70 px-1 py-px text-[10px] font-semibold text-primary">{dur}</span>
          )}
          {lowRes && (
            <span className="rounded-control bg-warn px-1 py-px text-[10px] font-semibold text-primary">low-res</span>
          )}
        </div>
      </button>
      <div className="space-y-1 p-2">
        <div className="line-clamp-2 text-xs font-medium" title={asset.title}>
          {asset.title || `${asset.provider} ${asset.provider_id}`}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-secondary">
          <span className="min-w-0 flex-1 truncate">{asset.provider}</span>
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
              className="mt-1 w-full rounded-control bg-elevated px-2 py-1 text-xs font-semibold text-secondary hover:bg-border-subtle"
            >
              ↩ Undo reject
            </button>
          )
        ) : (
          <div className="flex gap-1 pt-1">
            <button
              onClick={() => onUse(asset)}
              className="flex-1 rounded-control bg-success px-2 py-1 text-xs font-semibold text-primary hover:brightness-110"
            >
              Use
            </button>
            <button
              onClick={() => onReject(asset)}
              className="flex-1 rounded-control bg-danger-soft px-2 py-1 text-xs font-semibold text-danger hover:brightness-125"
            >
              Reject
            </button>
            <button
              onClick={() => onSimilar(asset)}
              title="Find Similar"
              className="rounded-control bg-elevated px-2 py-1 text-xs hover:bg-border-subtle"
            >
              ✨
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
