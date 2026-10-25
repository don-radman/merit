/**
 * Display helpers that are NOT money. Money formatting lives in `types.ts`
 * (`formatAmount`, `formatUsd`) because the frozen interface owns Amount.
 */
import type { Timestamp } from '@/lib/types.ts';

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "2027-01-24T10:00:00Z" -> "24 Jan" (this year) or "24 Jan 2027" (another). */
export function formatDate(iso: Timestamp, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() === now.getFullYear() ? DAY_MONTH.format(d) : DAY_MONTH_YEAR.format(d);
}

/** 50 -> "0.50%". Basis points are a trade term; a scout reads a percentage. */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/** Days from now until `iso`, floored at zero. */
export function daysUntil(iso: Timestamp, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
}

/** "a1b2c3…" for a hash or address, keeping both ends. */
export function shortRef(ref: string, head = 6, tail = 4): string {
  if (ref.length <= head + tail + 1) return ref;
  return `${ref.slice(0, head)}…${ref.slice(-tail)}`;
}
