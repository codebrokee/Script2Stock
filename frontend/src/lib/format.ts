function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** '16:9' | '9:16' | '1:1' for common frames, else reduced 'w:h'. '' when unknown. */
export function aspectLabel(width: number, height: number): string {
  if (!width || !height) return '';
  const r = width / height;
  if (Math.abs(r - 16 / 9) < 0.06) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.06) return '9:16';
  if (Math.abs(r - 1) < 0.06) return '1:1';
  const g = gcd(Math.round(width), Math.round(height)) || 1;
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}

/** 14 -> '0:14', 75 -> '1:15'. '' when unknown. */
export function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** ISO timestamp -> 'just now' | '5m ago' | '3h ago' | '2d ago'. */
export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
