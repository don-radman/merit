import type { ReactNode } from 'react';

/**
 * A two-or-three-way switch. Used for "Your view / What the world sees" on
 * the scout screen — the single most important control in the demo, because
 * flipping it is how privacy becomes visible instead of asserted.
 *
 * Semantics: a group of toggle buttons, exactly one pressed.
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
