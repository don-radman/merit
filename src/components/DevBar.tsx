import { useState } from 'react';
import {
  MODE,
  createClient,
  setStubFailure,
  setStubPayoutsReady,
  stubAdvanceVesting,
} from '@/lib/index.ts';
import type { ClientErrorCode } from '@/lib/index.ts';
import { currentLocation, navigate } from '@/route.ts';
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

export default function DevBar({ route, guide = false, onGuide }: { route: Route; guide?: boolean; onGuide?: () => void }) {
  const [armed, setArmed] = useState<ClientErrorCode | ''>('');

  // Dev builds always; production builds only when VITE_DEMO_BAR=1, which is
  // how the hosted click-through demo keeps its levers.
  if (!import.meta.env.DEV && import.meta.env.VITE_DEMO_BAR !== '1') return null;

  const scoutCode = route.screen === 'scout' ? route.code ?? 'CALDER-PR7' : 'CALDER-PR7';

  const reset = async () => {
    await createClient({ role: 'issuer' }).resetDemo();
    setStubFailure(null);
    setArmed('');
    const { path, search } = currentLocation();
    navigate(path + search);
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
      {onGuide && (
        <button className={`btn btn--ghost btn--sm${guide ? ' is-active' : ''}`} onClick={onGuide} title="Step-by-step talking points and the real transactions">
          Guide
        </button>
      )}

      <span className="devbar__group">
        <button className={`btn btn--ghost btn--sm${is('home')}`} onClick={() => navigate('/')}>
          Home
        </button>
        <button className={`btn btn--ghost btn--sm${is('investor')}`} onClick={() => navigate('/i/CALDER-PR7')}>
          Investor
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/i/CALDER-PR7?frame=phone')} title="Investor flow in a phone frame">
          Phone
        </button>
        <button className={`btn btn--ghost btn--sm${is('scout')}`} onClick={() => navigate('/scout')}>
          Adviser
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/scout?code=CALDER-DO2')} title="The other adviser, on a different rate">
          Adviser 2
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

      {/* Fail next and Reset act on the stub. In live mode they would mutate
          state nothing on screen reads, so they are not offered. */}
      {MODE === 'stub' && (
        <>
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
        </>
      )}
      {MODE === 'live' && <span className="muted small">reads are live · writes are not offered here</span>}
    </div>
  );
}
