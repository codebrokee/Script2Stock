import React from 'react';

export function LicenseBadge({ license }: { license: string }): React.ReactElement {
  const l = (license || 'unknown').toLowerCase();
  let cls = 'bg-gray-200 text-gray-700';
  let label = license || 'unknown';
  if (l.includes('cc0') || l.includes('public domain')) {
    cls = 'bg-green-200 text-green-800';
  } else if (l === 'cc-by' || l.includes('cc-by')) {
    cls = 'bg-yellow-200 text-yellow-800';
  } else if (l.includes('commercial-free') || l.includes('pexels') || l.includes('pixabay')) {
    cls = 'bg-blue-200 text-blue-800';
  }
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}
