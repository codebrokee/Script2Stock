import React from 'react';
import type { MediaAsset } from '../types';
import { LicenseBadge } from './LicenseBadge';

interface Props {
  asset: MediaAsset;
  onUse: (a: MediaAsset) => void;
  onReject: (a: MediaAsset) => void;
  onSimilar: (a: MediaAsset) => void;
}

export function MediaCard({ asset, onUse, onReject, onSimilar }: Props): React.ReactElement {
  const thumb = asset.cached_thumbnail || asset.thumbnail_url;
  const dim = asset.status === 'rejected' ? 'opacity-40 grayscale' : '';
  const ring = asset.status === 'selected' ? 'ring-2 ring-green-500' : 'ring-1 ring-gray-200';
  return (
    <div className={`overflow-hidden rounded-lg bg-white shadow-sm ${ring} ${dim}`}>
      <div className="aspect-video w-full bg-gray-100">
        {thumb ? (
          <img src={thumb} alt={asset.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">no preview</div>
        )}
      </div>
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
      </div>
    </div>
  );
}
