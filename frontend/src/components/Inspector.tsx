import React, { useState } from 'react';
import type { MediaAsset } from '../types';
import { aspectLabel, formatDuration } from '../lib/format';
import { FadeImg } from './FadeImg';
import { LicenseBadge } from './LicenseBadge';

export function LicensePanel({ asset }: { asset: MediaAsset }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  async function copyAttribution(): Promise<void> {
    const text =
      `${asset.title || 'Untitled'} by ${asset.creator || 'Unknown'} via ${asset.provider}. ` +
      `License: ${asset.license}${asset.license_url ? ` (${asset.license_url})` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (non-secure context) */
    }
  }

  return (
    <div className="rounded-control bg-inset p-3 text-xs">
      <div className="mb-1.5 flex items-center gap-2">
        <LicenseBadge license={asset.license} />
        <span className="prose-safe font-semibold text-primary">{asset.license || 'unknown'}</span>
      </div>
      <dl className="space-y-2 text-secondary">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-tertiary">Creator</dt>
          <dd className="truncate">{asset.creator || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-tertiary">Attribution</dt>
          <dd>{asset.attribution_required ? 'Required' : 'Not required'}</dd>
        </div>
      </dl>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => void copyAttribution()}
          className="flex-1 rounded-control bg-accent px-2 py-1.5 font-semibold text-primary hover:bg-accent-hover"
        >
          {copied ? 'Copied ✓' : 'Copy attribution'}
        </button>
        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-control bg-accent-soft px-2 py-1.5 text-center font-semibold text-accent-text hover:bg-accent hover:text-primary"
          >
            Open source page ↗
          </a>
        )}
      </div>
      {asset.license_url && (
        <a href={asset.license_url} target="_blank" rel="noreferrer" className="prose-safe mt-1 block text-accent-text hover:underline">
          {asset.license_url}
        </a>
      )}
    </div>
  );
}

interface Props {
  asset: MediaAsset;
  sceneIndex: number;
  onClose: () => void;
  onUse: () => void;
  onReject: () => void;
  onSimilar: () => void;
}

/** Right-side detail drawer for the focused media asset. */
export function Inspector({ asset, sceneIndex, onClose, onUse, onReject, onSimilar }: Props): React.ReactElement {
  const thumb = asset.cached_thumbnail || asset.thumbnail_url;
  const ratio = aspectLabel(asset.width, asset.height);
  const orientation = !asset.width || !asset.height ? '—' : asset.width > asset.height ? 'landscape' : asset.width < asset.height ? 'portrait' : 'square';
  const dur = asset.media_type === 'video' ? formatDuration(asset.duration) : '';

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label="Media inspector">
      {/* [overlay] dim backdrop; pure black keeps photos legible behind drawers */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-80 max-w-[90vw] flex-col bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="truncate text-sm font-bold text-primary">
            Scene {sceneIndex + 1} · {asset.provider}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close inspector (Esc)"
            className="rounded-control px-2 py-1 text-tertiary hover:bg-elevated hover:text-primary"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-card bg-bg-inset">
            {thumb ? (
              <FadeImg src={thumb} alt={asset.title} className="max-h-64 w-full object-contain" />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-tertiary">no preview</div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="prose-safe text-sm font-bold text-primary">{asset.title || `${asset.provider} ${asset.provider_id}`}</h3>
            {asset.description && <p className="prose-safe mt-1 text-xs leading-relaxed text-secondary">{asset.description}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-control bg-inset px-2 py-1.5">
              <dt className="text-tertiary">Dimensions</dt>
              <dd className="font-semibold">{asset.width > 0 ? `${asset.width}×${asset.height}` : '—'}</dd>
            </div>
            <div className="rounded-control bg-inset px-2 py-1.5">
              <dt className="text-tertiary">Orientation{ratio ? ` (${ratio})` : ''}</dt>
              <dd className="font-semibold">{orientation}</dd>
            </div>
            <div className="rounded-control bg-inset px-2 py-1.5">
              <dt className="text-tertiary">Type</dt>
              <dd className="font-semibold">{asset.media_type}</dd>
            </div>
            <div className="rounded-control bg-inset px-2 py-1.5">
              <dt className="text-tertiary">Duration</dt>
              <dd className="font-semibold">{dur || '—'}</dd>
            </div>
          </dl>
          <LicensePanel asset={asset} />
        </div>
        <div className="flex gap-2 border-t p-3">
          <button
            onClick={onUse}
            className="flex-1 rounded-control bg-success px-2 py-1.5 text-xs font-semibold text-primary hover:brightness-110"
          >
            Use ⏎
          </button>
          <button
            onClick={onReject}
            className="flex-1 rounded-control bg-danger-soft px-2 py-1.5 text-xs font-semibold text-danger hover:brightness-125"
          >
            Reject (X)
          </button>
          <button
            onClick={onSimilar}
            title="Find Similar (S)"
            className="rounded-control bg-elevated px-3 py-1.5 text-xs hover:bg-border-subtle"
          >
            ✨
          </button>
        </div>
      </aside>
    </div>
  );
}
