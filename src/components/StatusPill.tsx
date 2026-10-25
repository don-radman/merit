import type { BookEntry } from '@/lib/index.ts';
import { CheckIcon, ClockIcon, UndoIcon } from '@/components/icons.tsx';

type State = NonNullable<BookEntry['state']>;

/**
 * The four states an introduction can be in, in the words a scout uses.
 *
 *   vesting    "Vesting"   — invested; the fee is earned but inside its window
 *   claimable  "Ready"     — vested; it will pay on the next payout run
 *   claimed    "Paid"      — settled
 *   recovered  "Reversed"  — the investor exited early; the fund recovered it
 *
 * The on-chain names are kept in the type; the labels are ours. Never show
 * 'claimable' or 'recovered' to a scout.
 */
export const STATE_LABEL: Record<State, string> = {
  vesting: 'Vesting',
  claimable: 'Ready',
  claimed: 'Paid',
  recovered: 'Reversed',
};

export default function StatusPill({
  state,
  detail,
}: {
  state: State;
  /** Short trailing text, e.g. the pay date. */
  detail?: string;
}) {
  const icon =
    state === 'claimed' ? (
      <CheckIcon size={12} />
    ) : state === 'recovered' ? (
      <UndoIcon size={12} />
    ) : state === 'vesting' ? (
      <ClockIcon size={12} />
    ) : (
      <span className="pill__dot" aria-hidden />
    );
  return (
    <span className={`pill pill--${state}`}>
      {icon}
      <span>{STATE_LABEL[state]}</span>
      {detail && <span className="pill__detail">{detail}</span>}
    </span>
  );
}
