import { useState } from 'react';
import {
  MODE,
  createClient,
  setStubFailure,
  setStubPayoutsReady,
  stubAdvanceVesting,
} from '@/lib/index.ts';
import type { ClientErrorCode } from '@/lib/index.ts';
import { navigate } from '@/route.ts';
import type { Route } from '@/route.ts';

/**
 * Dev-only toolbar. Aimed at the demo, not at coding:
 *
 *   Screens    jump between the three screens and the phone frame
 *   Vest all   pretend the window has passed, so Ready and the payout run
 *              can be shown without waiting 90 days
 *   Show setup put the one-time "Set up payouts" card back
 *   Fail next  make the NEXT client call fail with a chosen code
 *   Reset      back to seeded fixture state — between every take
 *
 * It renders nothing in a production build.
 */
const ARMABLE: ClientErrorCode[] = [
  'passkey-declined',
  'passkey-unsupported',
  'kyc-failed',
  'unknown-code',
  'trustline-not-authorized',
  'insufficient-usdc',
  'below-minimum',
  'proof-failed',
  'not-yet-vested',
  'nothing-to-claim',
  'network',
];

export default function DevBar({ route }: { route: Route }) {
  const [armed, setArmed] = useState<ClientErrorCode | ''>('');

  if (!import.meta.env.DEV) return null;

  const scoutCode = route.screen === 'scout' ? route.code ?? 'CALDER-PR7' : 'CALDER-PR7';

  const reset = async () => {
    await createClient({ role: 'issuer' }).resetDemo();
    setStubFailure(null);
    setArmed('');
    navigate(location.pathname + location.search);
  };

  const arm = (code: ClientErrorCode | '') => {
    setArmed(code);
    setStubFailure(code === '' ? null : code);
  };

  const is = (s: Route['screen']) => (route.screen === s ? ' is-active' : '');

  return (
    <div className="devbar" role="toolbar" aria-label="Demo controls">
      <strong>demo</strong>
      <span className={`badge badge--${MODE}`}>{MODE}</span>

      <span className="devbar__group">
        <button className={`btn btn--ghost btn--sm${is('investor')}`} onClick={() => navigate('/i/CALDER-PR7')}>
          Investor
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/i/CALDER-PR7?frame=phone')} title="Investor flow in a phone frame">
          Phone
        </button>
        <button className={`btn btn--ghost btn--sm${is('scout')}`} onClick={() => navigate('/scout')}>
          Scout
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/scout?code=CALDER-DO2')} title="The other scout, on a different rate">
          Scout 2
        </button>
        <button className={`btn btn--ghost btn--sm${is('issuer')}`} onClick={() => navigate('/issuer')}>
          Fund
        </button>
      </span>

      <span className="spacer" />

      {MODE === 'stub' && (
        <span className="devbar__group">
          <button className="btn btn--ghost btn--sm" onClick={() => stubAdvanceVesting()} title="Pretend the vesting window has passed">
            Vest all
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setStubPayoutsReady(scoutCode, false)}
            title="Show the one-time payout setup card again"
          >
            Show setup
          </button>
        </span>
      )}

      <label htmlFor="arm" className="devbar__label">
        Fail next
      </label>
      <select id="arm" value={armed} onChange={(e) => arm(e.target.value as ClientErrorCode | '')}>
        <option value="">—</option>
        {ARMABLE.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <button className="btn btn--ghost btn--sm" onClick={reset}>
        Reset
      </button>
    </div>
  );
}
