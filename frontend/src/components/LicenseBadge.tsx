import React from 'react';

export function LicenseBadge({ license }: { license: string }): React.ReactElement {
  const l = (license || 'unknown').toLowerCase();
  let cls = 'bg-elevated text-tertiary';
  let label = license || 'unknown';
  if (l.includes('cc0') || l.includes('public domain')) {
    cls = 'bg-success-soft text-success';
  } else if (l === 'cc-by' || l.includes('cc-by')) {
    cls = 'bg-warn-soft text-warn';
  } else if (l.includes('commercial-free') || l.includes('pexels') || l.includes('pixabay')) {
    cls = 'bg-accent-soft text-accent-text';
  }
  return <span className={`inline-block rounded-control px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}
