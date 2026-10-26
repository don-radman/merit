import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell.tsx';
import { CheckIcon } from '@/components/icons.tsx';
import {
  FUND,
  createClient,
  formatAmount,
  formatUsd,
} from '@/lib/index.ts';
import type {
  ClientError,
  ClientErrorCode,
  HoldingsStatement,
  KycInput,
  SubscriptionReceipt,
  SubscriptionStage,
  Wallet,
} from '@/lib/index.ts';

/**
 * Screen 1 of 3 — the one that is never cut.
 *
 * Deliberate choices here, all from the brief: no jargon on screen (the
 * investors on these calls "do not know much about blockchain"), the six flow
 * stages shown as real progress because two of them are real waits, and copy
 * on the proving step that explains the product while the user waits for it.
 */

/**
 * Five stages, not six. There is no proof on this path \u2014 the contract records
 * the introduction in the clear by design, and the only proof in the system
 * is the fund's, at settlement. The 'generating-proof' stage id still exists
 * in the frozen type and is simply never emitted.
 */
const STAGES: Array<{ id: SubscriptionStage; label: string; note?: string }> = [
  { id: 'awaiting-signature', label: 'Confirming with Face ID' },
  {
    id: 'authorizing-trustline',
    label: 'Calder is approving your account',
    note: 'The fund checks your details and approves your account before any units can be issued. This is the one step that takes a moment.',
  },
  { id: 'transferring-usdc', label: 'Sending your US dollars' },
  { id: 'minting-units', label: 'Issuing your fund units' },
  { id: 'accruing-fee', label: 'Recording your introduction' },
];

const ERROR_COPY: Record<ClientErrorCode, { title: string; body: string }> = {
  'passkey-declined': {
    title: 'Sign-in cancelled',
    body: 'You closed the passkey prompt before it finished. Nothing was sent.',
  },
  'passkey-unsupported': {
    title: 'This browser cannot create a passkey',
    body: 'Try Safari or Chrome on this device. A passkey works like Face ID or a fingerprint — there is no password to remember and nothing to write down.',
  },
  'kyc-failed': {
    title: 'We could not verify those details',
    body: 'Check the spelling of your name and try again.',
  },
  'unknown-code': {
    title: 'That introducer link is not valid',
    body: 'Ask whoever sent it to you for a fresh link.',
  },
  'trustline-not-authorized': {
    title: 'The fund has not approved your account yet',
    body: 'This is normally quick. Nothing has been taken from you.',
  },
  'insufficient-usdc': {
    title: 'Not enough US dollars in your account',
    body: 'Top up and try again. Nothing has been taken.',
  },
  'below-minimum': { title: 'Below the minimum subscription', body: '' },
  'proof-failed': {
    title: 'Could not complete the private fee record',
    body: 'Your subscription was not submitted and nothing has been taken. Trying again is safe.',
  },
  'nothing-to-claim': { title: 'Nothing to claim', body: 'No fee has accrued yet.' },
  'not-yet-vested': {
    title: 'Not available yet',
    body: 'This fee has been earned but is still inside its holding period. It becomes available to withdraw once that period ends.',
  },
  network: {
    title: 'Connection problem',
    body: 'We could not reach the network. Your subscription was not submitted.',
  },
  unknown: {
    title: 'Something went wrong',
    body: 'Nothing was submitted. Trying again is safe.',
  },
};

type Step =
  | 'loading'
  | 'no-code'
  | 'bad-code'
  | 'intro'
  | 'kyc'
  | 'amount'
  | 'subscribing'
  | 'done';

interface Resolved {
  code: string;
  displayName: string;
  fundName: string;
  minimumSubscription: string;
}

function asClientError(e: unknown): ClientError {
  const err = e as ClientError;
  if (err && typeof err.code === 'string') return err;
  const fallback = new Error(String(e)) as ClientError;
  fallback.code = 'unknown';
  fallback.retryable = false;
  return fallback;
}

export default function InvestorSubscribe({ code }: { code: string | null }) {
  const client = useMemo(() => createClient({ role: 'investor' }), []);

  const [step, setStep] = useState<Step>(code ? 'loading' : 'no-code');
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [stage, setStage] = useState<SubscriptionStage | null>(null);
  const [receipt, setReceipt] = useState<SubscriptionReceipt | null>(null);
  const [holdings, setHoldings] = useState<HoldingsStatement | null>(null);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);

  const [kyc, setKyc] = useState<KycInput>({
    fullName: '',
    countryCode: 'SG',
    category: 'family-office',
  });
  const [amount, setAmount] = useState('250000.00');

  // The investor is the fund's client, so the tab says the fund, not Merit.
  useEffect(() => {
    document.title = FUND.name;
  }, []);

  // Resolve the code from the link before showing anything, so a stale link is
  // an error state rather than a failed subscription five steps later.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setStep('loading');
    client
      .resolveCode(code)
      .then((r) => {
        if (cancelled) return;
        setResolved(r);
        setStep('intro');
      })
      .catch((e) => {
        if (cancelled) return;
        setError(asClientError(e));
        setStep('bad-code');
      });
    return () => {
      cancelled = true;
    };
  }, [client, code]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(asClientError(e));
    } finally {
      setBusy(false);
    }
  };

  const createWallet = () =>
    run(async () => {
      setWallet(await client.createWallet());
      setStep('kyc');
    });

  const submitKyc = () =>
    run(async () => {
      const result = await client.submitKyc(kyc);
      if (result.status !== 'passed') {
        const e = new Error(result.reason ?? 'KYC failed') as ClientError;
        e.code = 'kyc-failed';
        e.retryable = true;
        throw e;
      }
      setStep('amount');
    });

  const subscribe = () =>
    run(async () => {
      setStep('subscribing');
      setStage(null);
      try {
        const r = await client.subscribe({
          code: resolved!.code,
          usdcAmount: amount,
          onStage: setStage,
        });
        setReceipt(r);
        setHoldings(await client.getHoldings(wallet?.address));
        setStep('done');
      } catch (e) {
        setStep('amount');
        throw e;
      }
    });

  const errorBanner = error && (
    <div className="banner banner--err" role="alert">
      <strong>{ERROR_COPY[error.code].title}</strong>
      {error.code === 'below-minimum' && error.details?.minimum
        ? `The minimum is ${formatUsd(error.details.minimum)}.`
        : ERROR_COPY[error.code].body}
    </div>
  );

  // ---- empty and error entry states ---------------------------------------

  if (step === 'no-code') {
    return (
      <Shell brand="fund">
        <h1>{FUND.name}</h1>
        <p className="muted">
          This fund is offered through introducers. Open the link your
          introducer sent you to subscribe.
        </p>
      </Shell>
    );
  }

  if (step === 'loading') {
    return (
      <Shell brand="fund">
        <p className="muted">
          <span className="spinner" /> Checking your link…
        </p>
      </Shell>
    );
  }

  if (step === 'bad-code' || !resolved) {
    return (
      <Shell brand="fund">
        <h1>{FUND.name}</h1>
        {errorBanner}
      </Shell>
    );
  }

  // ---- the flow ------------------------------------------------------------

  return (
    <Shell brand="fund">
      <div className="eyebrow">Introduced by {resolved.displayName}</div>
      <h1>{resolved.fundName}</h1>
      <p className="muted">
        A short-duration income fund, domiciled in {FUND.domicile}. Minimum
        subscription {formatUsd(resolved.minimumSubscription)}.
      </p>

      {step !== 'subscribing' && errorBanner}

      {step === 'intro' && (
        <div className="card">
          <h2>Create your account</h2>
          <p className="muted">
            Secured with the Face ID, fingerprint or device PIN you already use.
            Nothing to remember, nothing to write down.
          </p>
          <div className="actions">
            <button className="btn" onClick={createWallet} disabled={busy} aria-busy={busy}>
              {busy && <span className="spinner" />} Create account
            </button>
          </div>
        </div>
      )}

      {step === 'kyc' && (
        <div className="card">
          <h2>Confirm who you are</h2>
          <p className="muted small">
            The fund is required to check this before it can issue you units.
          </p>

          <label htmlFor="name">Full legal name</label>
          <input
            id="name"
            value={kyc.fullName}
            autoComplete="name"
            onChange={(e) => setKyc({ ...kyc, fullName: e.target.value })}
          />

          <label htmlFor="country">Country of residence</label>
          <select
            id="country"
            value={kyc.countryCode}
            onChange={(e) => setKyc({ ...kyc, countryCode: e.target.value })}
          >
            <option value="SG">Singapore</option>
            <option value="AU">Australia</option>
            <option value="NZ">New Zealand</option>
            <option value="GB">United Kingdom</option>
          </select>

          <label htmlFor="category">You are investing as</label>
          <select
            id="category"
            value={kyc.category}
            onChange={(e) =>
              setKyc({ ...kyc, category: e.target.value as KycInput['category'] })
            }
          >
            <option value="individual">An individual</option>
            <option value="family-office">A family office</option>
            <option value="institution">An institution</option>
          </select>

          <div className="actions">
            <button className="btn" onClick={submitKyc} disabled={busy || kyc.fullName.trim().length < 2} aria-busy={busy}>
              {busy && <span className="spinner" />} Check my details
            </button>
          </div>
        </div>
      )}

      {step === 'amount' && (
        <div className="card">
          <h2>How much would you like to subscribe?</h2>
          <label htmlFor="amount">Amount in US dollars</label>
          <div className="amount">
            <span>US$</span>
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            You will receive units of the fund at{' '}
            {formatUsd(FUND.unitPrice)} per unit. {resolved.displayName} is paid
            a fee by the fund — not by you — and never sees your balance.
          </p>
          <div className="actions">
            <button className="btn" onClick={subscribe} disabled={busy || !amount.trim()}>
              Subscribe {amount.trim() ? formatUsd(amount) : ''}
            </button>
          </div>
        </div>
      )}

      {step === 'subscribing' && (
        <div className="card">
          <h2>Setting up your subscription</h2>
          <p className="muted small">
            Please keep this page open. Nothing is final until every step
            below is complete.
          </p>
          <ul className="stages">
            {STAGES.map((s) => {
              const current = STAGES.findIndex((x) => x.id === stage);
              const mine = STAGES.findIndex((x) => x.id === s.id);
              const state =
                stage === null ? 'idle' : mine < current ? 'done' : mine === current ? 'active' : 'idle';
              return (
                <li key={s.id} data-state={state}>
                  <span className="mark">
                    {state === 'done' ? (
                      <CheckIcon size={14} label="Done" />
                    ) : state === 'active' ? (
                      <span className="spinner" />
                    ) : (
                      <span className="stage-dot" aria-hidden />
                    )}
                  </span>
                  <span>
                    {s.label}
                    {state === 'active' && s.note && <span className="note">{s.note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === 'done' && holdings && receipt && (
        <>
          <div className="banner banner--ok">
            <strong>You are invested.</strong>
            {formatUsd(receipt.subscribed)} subscribed through{' '}
            {receipt.introducer.displayName}.
          </div>

          <div className="card">
            <div className="eyebrow">Your holding</div>
            <div className="hero-figure">{formatAmount(holdings.units)}</div>
            <p className="muted small">
              units of {holdings.unitCode} · worth about{' '}
              {formatUsd(holdings.valueUsd)}
            </p>
            <dl className="kv" style={{ marginTop: 18 }}>
              <dt>Subscribed</dt>
              <dd>{formatUsd(holdings.subscribedTotal)}</dd>
              <dt>Price per unit</dt>
              <dd>{formatUsd(holdings.unitPrice)}</dd>
              <dt>Fund approved your account</dt>
              <dd>{holdings.issuerControls.trustlineAuthorized ? 'Yes' : 'Pending'}</dd>
            </dl>
          </div>

          <div className="card">
            <h2>What this means</h2>
            <ul className="statement">
              {holdings.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <p className="muted small" style={{ marginTop: 16 }}>
            Recorded on Stellar · reference {receipt.txHash.slice(0, 12)}…
          </p>
        </>
      )}
    </Shell>
  );
}
