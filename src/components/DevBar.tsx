import { useState } from 'react';
import { MODE, createClient, setStubFailure } from '../lib/index.ts';
import type { ClientErrorCode } from '../lib/index.ts';
import { navigate } from '../route.ts';
import type { Route } from '../route.ts';

/**
 * Dev-only toolbar. Two jobs, both aimed at the demo rather than at coding:
 *
 *   Reset   — back to seeded fixture state. You will hit this between every
 *             video take, far more than anything else here.
 *   Arm     — make the NEXT client call fail with a chosen code, so the error
 *             states actually get built and can be shown on camera.
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
  'network',
];

export default function DevBar({ route }: { route: Route }) {
  const [armed, setArmed] = useState<ClientErrorCode | ''>('');

  if (!import.meta.env.DEV) return null;

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

  return (
    <div className="devbar">
      <strong>dev</strong>
      {MODE === 'stub' && <span className="badge">STUB</span>}

      <button className="secondary" onClick={() => navigate('/i/CALDER-PR7')}>
        Investor
      </button>
      <button className="secondary" onClick={() => navigate('/introducer')}>
        Book
      </button>
      <button className="secondary" onClick={() => navigate('/issuer')}>
        Ledger
      </button>

      <span className="spacer" />

      <label htmlFor="arm" style={{ margin: 0 }}>
        Fail next:
      </label>
      <select
        id="arm"
        value={armed}
        onChange={(e) => arm(e.target.value as ClientErrorCode | '')}
      >
        <option value="">— nothing —</option>
        {ARMABLE.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <button className="secondary" onClick={reset}>
        Reset demo
      </button>
      <span className="muted small">{route.screen}</span>
    </div>
  );
}
