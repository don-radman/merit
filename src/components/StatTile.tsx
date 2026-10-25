import type { ReactNode } from 'react';
import { LockIcon } from '@/components/icons.tsx';

/**
 * One number, one label, optional one-line hint. The tile does not interpret
 * the number: pass it formatted. `locked` adds the small lock that marks a
 * figure as confidential — decrypted for this viewer only.
 */
export default function StatTile({
  label,
  value,
  hint,
  locked = false,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  locked?: boolean;
  tone?: 'default' | 'accent' | 'quiet';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__label">
        {label}
        {locked && <LockIcon size={12} label="Confidential — only you can see this figure" />}
      </div>
      <div className="stat__value tnum">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}
