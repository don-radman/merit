import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell.tsx';
import StatTile from '@/components/StatTile.tsx';
import StatusPill from '@/components/StatusPill.tsx';
import Segmented from '@/components/Segmented.tsx';
import CopyButton from '@/components/CopyButton.tsx';
import { SkeletonRows, SkeletonStats } from '@/components/Skeleton.tsx';
import { useToast } from '@/components/Toast.tsx';
import { FingerprintIcon, LockIcon, ShieldCheckIcon } from '@/components/icons.tsx';
import { FUND, MODE, PRODUCT, createClient, formatUsd, linkFor, liveMethods } from '@/lib/index.ts';
import type { BookEntry, ClientError, ClientErrorCode } from '@/lib/index.ts';
import { useLiveData } from '@/lib/useLiveData.ts';
import { formatBps, formatDate } from '@/lib/format.ts';

/**
 * Screen 2 of 3 — the scout's book. The hero.
 *
 * One screen answers the four questions a scout asks every quarter:
 *   Did they log my introduction?   -> the row appears the moment the client invests
 *   When do I get paid?             -> every row carries its date
 *   Is the number right?            -> the fee is computed at THEIR rate, and only they see it
 *   Who else can see my rate?       -> flip "What the world sees" and watch the fee vanish
 *
 * Nothing on this screen says blockchain. "Recorded on Stellar" is the one
 * concession, and it is a reassurance, not a feature.
 */

type View = 'mine' | 'public';

const ACTION_COPY: Partial<Record<ClientErrorCode, { title: string; body: string }>> = {
  'not-yet-vested': {
    title: 'Nothing to collect yet',
    body: 'Your fees are earned but still inside their holding period. They pay automatically when it ends.',
  },
  'nothing-to-claim': {
    title: 'Nothing to collect',
    body: 'No fee is ready right now.',
  },
  'passkey-declined': {
    title: 'Cancelled',
    body: 'You closed the prompt before it finished. Nothing changed.',
  },
  'proof-failed': {
    title: 'Could not complete that',
    body: 'Nothing changed. Trying again is safe.',
  },
  network: {
    title: 'Connection problem',
    body: 'We could not reach the network. Nothing changed.',
  },
};

function statusDetail(e: BookEntry): string | undefined {
  switch (e.state) {
    case 'vesting':
      return `pays ${formatDate(e.vestsAt)}`;
    case 'claimable':
      return 'next payout run';
    case 'claimed':
      return e.feePaidAt ? formatDate(e.feePaidAt) : undefined;
    case 'recovered':
      return 'client exited early';
    default:
      return e.vested ? 'next payout run' : `pays ${formatDate(e.vestsAt)}`;
  }
}

function asClientError(e: unknown): ClientError {
  const err = e as ClientError;
  if (err && typeof err.code === 'string') return err;
  const fallback = new Error(String(e)) as ClientError;
  fallback.code = 'unknown';
  fallback.retryable = false;
  return fallback;
}

export default function ScoutDashboard({ code }: { code: string | null }) {
  const client = useMemo(
    () => createClient({ role: 'introducer', code: code ?? undefined }),
    [code],
  );
  const { data: book, error, loading, refetch } = useLiveData(() => client.getBook(), [client]);
  const [view, setView] = useState<View>('mine');
  const [busy, setBusy] = useState<'setup' | 'collect' | null>(null);
  const [actionError, setActionError] = useState<ClientError | null>(null);
  const { push } = useToast();

  useEffect(() => {
    document.title = `Your book · ${PRODUCT.name}`;
  }, []);

  const run = async (what: 'setup' | 'collect', fn: () => Promise<void>) => {
    setBusy(what);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(asClientError(e));
    } finally {
      setBusy(null);
    }
  };

  const setUp = () =>
    run('setup', async () => {
      await client.setUpPayouts?.();
      push({ title: 'Payouts set up', body: 'Fees will land in your account automatically.' });
      await refetch();
    });

  const collect = () =>
    run('collect', async () => {
      const r = await client.claimFee();
      push({ title: `Paid ${formatUsd(r.amount)}`, body: 'Privately. Only you, the fund and its auditor can see the amount.' });
      await refetch();
    });

  const isPublic = view === 'public';
  const viewer = book ? (
    <>
      <span>{book.displayName}</span>
      <span className="shell__sep" aria-hidden>
        ·
      </span>
      <span className="muted">{PRODUCT.roleLabel}</span>
    </>
  ) : undefined;

  // ---- loading / error entry states --------------------------------------

  if (loading && !book) {
    return (
      <Shell wide viewer={viewer}>
        <div className="page-head">
          <div>
            <div className="eyebrow">{PRODUCT.roleLabel}</div>
            <h1>Your book</h1>
          </div>
        </div>
        <SkeletonStats />
        <section className="card card--flush" style={{ marginTop: 20 }}>
          <SkeletonRows rows={4} />
        </section>
      </Shell>
    );
  }

  if (error && !book) {
    return (
      <Shell wide>
        <h1>Your book</h1>
        <div className="banner banner--err" role="alert">
          <strong>We could not load your book</strong>
          {error.message}
        </div>
        <button className="btn btn--secondary" onClick={() => void refetch()}>
          Try again
        </button>
      </Shell>
    );
  }

  if (!book) return null;

  const ready = book.entries.filter((e) => e.state === 'claimable' || (e.state === undefined && e.vested));
  const vesting = book.entries.filter((e) => e.state === 'vesting' || (e.state === undefined && !e.vested));
  const paid = book.entries.filter((e) => e.state === 'claimed');
  const lastPaid = paid
    .map((e) => e.feePaidAt ?? e.vestsAt)
    .sort()
    .at(-1);
  const hasClaimable = Number(book.totals.feeClaimable.replace(/,/g, '')) > 0;
  // In live mode the reads are real but `claimFee` is still the stub, so a
  // Collect button would report a fixture number next to a live one. Only
  // offer it when the client that would honour it is the one on screen.
  const canCollect =
    MODE === 'stub' || (liveMethods as readonly string[]).includes('claimFee');
  const link = linkFor(book.code);
  const mask = <span className="mask" aria-label="Not on the public record">••••</span>;

  return (
    <Shell wide viewer={viewer}>
      {/* ---- head ---------------------------------------------------------- */}
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {PRODUCT.roleLabel} · {book.code}
          </div>
          <h1>{book.displayName}</h1>
          <p className="muted">
            Introducing clients to the {FUND.name}.{' '}
            <span className="nowrap">
              <LockIcon size={12} /> Your rate: <b>{formatBps(book.trailFeeBps)}</b> · private
            </span>
          </p>
        </div>
        <div className="share">
          <label className="share__label" htmlFor="share-link">
            Your link
          </label>
          <div className="share__row">
            <input id="share-link" className="share__field" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton text={link}>Copy link</CopyButton>
          </div>
          <p className="muted small share__hint">
            Anyone who invests through it is recorded as yours. Instantly.
          </p>
        </div>
      </div>

      {/* ---- one-time setup ------------------------------------------------- */}
      {book.payoutsReady === false && (
        <section className="card card--accent setup" aria-labelledby="setup-h">
          <div className="setup__icon" aria-hidden>
            <FingerprintIcon size={22} />
          </div>
          <div className="setup__body">
            <div className="eyebrow">One time</div>
            <h2 id="setup-h">Set up payouts</h2>
            <p className="muted">
              Choose where your fees land. One Face ID, and you will not be asked again — like
              adding a bank account to any referral programme.
            </p>
            {actionError && busy === null && ACTION_COPY[actionError.code] && (
              <div className="banner banner--err" role="alert">
                <strong>{ACTION_COPY[actionError.code]!.title}</strong>
                {ACTION_COPY[actionError.code]!.body}
              </div>
            )}
          </div>
          <div className="setup__action">
            <button className="btn" onClick={setUp} disabled={busy !== null}>
              {busy === 'setup' ? (
                <>
                  <span className="spinner" /> Waiting for Face ID…
                </>
              ) : (
                'Set up payouts'
              )}
            </button>
          </div>
        </section>
      )}

      {/* ---- the three numbers ---------------------------------------------- */}
      <div className="stats">
        <StatTile
          label="Earned"
          locked
          value={isPublic ? mask : formatUsd(book.totals.feeAccrued)}
          hint={
            isPublic
              ? 'Not on the public record'
              : `across ${book.totals.introducedCount} introduction${book.totals.introducedCount === 1 ? '' : 's'}`
          }
        />
        <StatTile
          label="On its way"
          locked
          tone="accent"
          value={isPublic ? mask : formatUsd(book.totals.feeVesting === '0.00' && book.totals.feeClaimable === '0.00' ? '0.00' : addStrings(book.totals.feeVesting, book.totals.feeClaimable))}
          hint={
            isPublic
              ? 'Not on the public record'
              : `${ready.length} payable · ${vesting.length} vesting`
          }
        />
        <StatTile
          label="Paid out"
          locked
          value={isPublic ? mask : formatUsd(book.totals.feeClaimed)}
          hint={isPublic ? 'Not on the public record' : lastPaid ? `last ${formatDate(lastPaid)}` : 'nothing yet'}
        />
      </div>

      {/* ---- the list ------------------------------------------------------- */}
      <section className="card card--flush" aria-labelledby="intro-h">
        <div className="card__head">
          <h2 id="intro-h">Introductions</h2>
          <Segmented<View>
            label="Which view"
            value={view}
            onChange={setView}
            options={[
              { value: 'mine', label: 'Your view' },
              { value: 'public', label: 'What the world sees' },
            ]}
          />
        </div>

        {isPublic && (
          <div className="banner banner--info" role="note">
            <strong>This is the public record on Stellar.</strong>
            That {book.displayName} introduced each investor, how much they invested, and whether the
            fee has vested, been paid or been reversed. <b>Not your rate. Not what you are paid.</b>
          </div>
        )}

        {book.entries.length === 0 ? (
          <div className="empty">
            <h3>No introductions yet</h3>
            <p className="muted">
              Share your link. The moment a client invests through it, they appear here and your fee
              starts vesting.
            </p>
          </div>
        ) : (
          <div className={`rows${isPublic ? ' rows--public' : ''}`} role="table" aria-label="Introductions">
            <div className="row row--head" role="row">
              <span role="columnheader">Investor</span>
              <span role="columnheader" className="num">
                Invested
              </span>
              <span role="columnheader" className="num">
                Your fee
              </span>
              <span role="columnheader">Status</span>
            </div>
            {book.entries.map((e, i) => {
              const state = e.state ?? (e.vested ? 'claimable' : 'vesting');
              return (
                <div
                  className={`row row--${state}`}
                  role="row"
                  key={e.id ?? `${e.at}-${i}`}
                  style={{ ['--i' as string]: i }}
                >
                  <span role="cell" className="row__who">
                    <span className="row__name">{e.investorLabel}</span>
                    <span className="row__meta muted small">Invested {formatDate(e.at)}</span>
                  </span>
                  <span role="cell" className="num tnum" data-label="Invested">
                    {formatUsd(e.subscribed)}
                  </span>
                  <span role="cell" className="num tnum row__fee" data-label="Your fee">
                    {isPublic ? mask : state === 'recovered' ? <s className="muted">{formatUsd(e.feeAccrued)}</s> : formatUsd(e.feeAccrued)}
                  </span>
                  <span role="cell">
                    <StatusPill state={state} detail={statusDetail(e)} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isPublic && book.entries.length > 0 && (
          <p className="muted small card__foot">
            On chain, investors appear as account addresses; names are shown here for readability.
          </p>
        )}
      </section>

      {/* ---- collect -------------------------------------------------------- */}
      {!isPublic && hasClaimable && canCollect && (
        <section className="card collect" aria-labelledby="collect-h">
          <div>
            <h2 id="collect-h">
              {formatUsd(book.totals.feeClaimable)} is payable
            </h2>
            <p className="muted">
              It pays automatically on the fund’s next payout run. Collect now if you would rather not wait.
            </p>
            {actionError && busy === null && ACTION_COPY[actionError.code] && (
              <div className="banner banner--err" role="alert">
                <strong>{ACTION_COPY[actionError.code]!.title}</strong>
                {ACTION_COPY[actionError.code]!.body}
              </div>
            )}
          </div>
          <div className="collect__action">
            <button
              className="btn btn--secondary"
              onClick={collect}
              disabled={busy !== null || book.payoutsReady === false}
              title={book.payoutsReady === false ? 'Set up payouts first' : undefined}
            >
              {busy === 'collect' ? (
                <>
                  <span className="spinner" /> Collecting…
                </>
              ) : (
                'Collect now'
              )}
            </button>
            {book.payoutsReady === false && <span className="muted small">Set up payouts first</span>}
          </div>
        </section>
      )}

      <p className="muted small foot">
        <ShieldCheckIcon size={14} /> Recorded on Stellar ·{' '}
        {MODE === 'live' ? 'reading the testnet contract' : 'demo data'}
      </p>
    </Shell>
  );
}

/** Add two display Amounts without a float. Local to this screen. */
function addStrings(a: string, b: string): string {
  const cents = (s: string) => {
    const [w, f = '0'] = s.split('.');
    return Number(w) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
  };
  const total = cents(a) + cents(b);
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}
