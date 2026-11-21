export const DEFAULT_KHR_RATE = 4000;

export function formatKhr(
  usd: number,
  compact = false,
  rate = DEFAULT_KHR_RATE,
): string {
  const khr = Math.round(usd * rate);
  if (compact && khr >= 1_000_000) {
    return `KHR ${(khr / 1_000_000).toFixed(2)}M`;
  }
  return `KHR ${khr.toLocaleString('en-US')}`;
}

export function formatRiel(usd: number, rate = DEFAULT_KHR_RATE): string {
  return `៛${Math.round(usd * rate).toLocaleString('en-US')}`;
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
