import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell.tsx';
import StatTile from '@/components/StatTile.tsx';
import StatusPill from '@/components/StatusPill.tsx';
import { SkeletonRows, SkeletonStats } from '@/components/Skeleton.tsx';
import { useToast } from '@/components/Toast.tsx';
import { ShieldCheckIcon } from '@/components/icons.tsx';
import { FUND, MODE, PRODUCT, createClient, formatUsd } from '@/lib/index.ts';
import type { ClientError, LedgerRow, SettlementReceipt } from '@/lib/index.ts';
import { useLiveData } from '@/lib/useLiveData.ts';
import { formatDate, shortRef } from '@/lib/format.ts';

/**
 * Screen 3 of 3 — the fund's console. Dense on purpose: this is the one
 * screen for professionals, and it is on camera for ten seconds.
 *
 * Two things happen here that happen nowhere else:
 *   - the payout run: every vested introduction settled at its scout's own
 *     rate, privately, in one click. The issuer's proof lives here.
 *   - the auditor line: totals reconcile through the auditor's key without
 *     any scout's rate or payout being public.
 */

function rowState(r: LedgerRow): NonNullable<LedgerRow['state']> {
  if (r.state) return r.state;
  if (r.feeSettled) return 'claimed';
  return Date.parse(r.vestsAt) <= Date.now() ? 'claimable' : 'vesting';
}

export default function IssuerConsole() {
  const client = useMemo(() => createClient({ role: 'issuer' }), []);
  const ledger = useLiveData(() => client.getLedger(), [client]);
  const audit = useLiveData(() => client.getAuditorAttestation(), [client]);
  const [running, setRunning] = useState(false);
  const [receipt, setReceipt] = useState<SettlementReceipt | null>(null);
  const [runError, setRunError] = useState<ClientError | null>(null);
  const { push } = useToast();

  useEffect(() => {
    document.title = `Attribution ledger · ${PRODUCT.name}`;
  }, []);

  const canRun = typeof client.runSettlement === 'function';
  // One word for one role, shared with the Calder portal (PRODUCT.roleLabel).
  const role = PRODUCT.roleLabel.toLowerCase();
  const roles = `${role}s`;
  const n = (count: number) => (count === 1 ? role : roles);

  const runPayout = async () => {
    if (!client.runSettlement) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await client.runSettlement();
      setReceipt(r);
      if (r.settledCount > 0) {
        push({
          title: `Paid ${r.introducerCount} ${n(r.introducerCount)} privately`,
          body: `${r.settledCount} introduction${r.settledCount === 1 ? '' : 's'} settled. No amount appears on chain.`,
        });
      } else {
        push({ title: 'Nothing to settle', body: 'Every vested introduction is already paid.', kind: 'info' });
      }
      await Promise.all([ledger.refetch(), audit.refetch()]);
    } catch (e) {
      setRunError(e as ClientError);
    } finally {
      setRunning(false);
    }
  };

  const viewer = (
    <>
      <span>Calder</span>
      <span className="shell__sep" aria-hidden>
        ·
      </span>
      <span className="muted">Fund operations</span>
    </>
  );

  if (ledger.loading && !ledger.data) {
    return (
      <Shell wide viewer={viewer}>
        <div className="page-head">
          <div>
            <div className="eyebrow">Fund</div>
            <h1>Attribution ledger</h1>
          </div>
        </div>
        <SkeletonStats count={4} />
        <section className="card card--flush" style={{ marginTop: 20 }}>
          <SkeletonRows rows={5} />
        </section>
      </Shell>
    );
  }

  if (ledger.error && !ledger.data) {
    return (
      <Shell wide viewer={viewer}>
        <h1>Attribution ledger</h1>
        <div className="banner banner--err" role="alert">
          <strong>We could not load the ledger</strong>
          {ledger.error.message}
        </div>
        <button className="btn btn--secondary" onClick={() => void ledger.refetch()}>
          Try again
        </button>
      </Shell>
    );
  }

  const data = ledger.data!;
  const rows = data.rows.map((r) => ({ ...r, state: rowState(r) }));
  const readyRows = rows.filter((r) => r.state === 'claimable');
  const readyTotal = readyRows.reduce((sum, r) => sum + cents(r.feeAccrued), 0);
  const readyScouts = new Set(readyRows.map((r) => r.introducerCode)).size;

  return (
    <Shell wide viewer={viewer}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Fund</div>
          <h1>Attribution ledger</h1>
          <p className="muted">
            {FUND.name} · {data.totals.introducerCount} {n(data.totals.introducerCount)} ·{' '}
            {data.totals.investorCount} investor{data.totals.investorCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="stats stats--4">
        <StatTile label={`Invested through ${roles}`} value={formatUsd(data.totals.subscribedTotal)} hint={`${formatUsd(data.totals.unitsIssued)} units issued`} />
        <StatTile
          label="Fee liability"
          value={formatUsd(data.totals.outstandingFeeLiability)}
          hint={`${formatUsd(data.totals.feeVestingTotal)} still vesting`}
          tone="quiet"
        />
        <StatTile
          label="Payable now"
          value={formatUsd(fromCents(readyTotal))}
          hint={readyRows.length ? `${readyRows.length} introduction${readyRows.length === 1 ? '' : 's'} · ${readyScouts} ${n(readyScouts)}` : 'nothing waiting'}
          tone="accent"
        />
        <StatTile label="Paid to date" value={formatUsd(data.totals.feesSettledTotal)} />
      </div>

      {/* ---- payout run --------------------------------------------------- */}
      <section className="card payout" aria-labelledby="payout-h">
        <div className="payout__body">
          <h2 id="payout-h">Payout run</h2>
          <p className="muted">
            Settles every vested introduction at each {role}’s own rate, in one go. One confidential
            transfer per {role} — the amounts never appear on chain, and no {role} learns another’s terms.
          </p>
          {receipt && !running && (
            <p className="small receipt" role="status">
              <ShieldCheckIcon size={14} /> {receipt.settledCount} settled · {receipt.introducerCount}{' '}
              {n(receipt.introducerCount)} · proved and sent in {(receipt.provingMs / 1000).toFixed(1)}s · ref{' '}
              <span className="mono">{shortRef(receipt.txHash)}</span>
            </p>
          )}
          {runError && (
            <div className="banner banner--err" role="alert">
              <strong>Payout run did not complete</strong>
              Nothing was paid. Trying again is safe.
            </div>
          )}
          {!canRun && (
            <p className="muted small">
              In live mode the payout run is executed by the issuer’s settlement service
              (<span className="mono">scripts/confidential.sh settle</span>), which holds the pool’s opening and the rates.
            </p>
          )}
        </div>
        <div className="payout__action">
          <button className="btn" onClick={runPayout} disabled={!canRun || running || readyRows.length === 0}>
            {running ? (
              <>
                <span className="spinner" /> Proving and settling…
              </>
            ) : readyRows.length === 0 ? (
              'Nothing payable'
            ) : (
              `Run payout · ${readyRows.length}`
            )}
          </button>
          {running && <span className="muted small">Each transfer carries a proof. Amounts stay sealed.</span>}
        </div>
      </section>

      {/* ---- ledger ------------------------------------------------------- */}
      <section className="card card--flush" aria-labelledby="ledger-h">
        <div className="card__head">
          <h2 id="ledger-h">Introductions</h2>
          <span className="muted small">Fees shown at each {role}’s private rate — visible to the fund only</span>
        </div>
        <div className="rows rows--ledger" role="table" aria-label="Attribution ledger">
          <div className="row row--head" role="row">
            <span role="columnheader">Investor</span>
            <span role="columnheader">{PRODUCT.roleLabel}</span>
            <span role="columnheader" className="num">
              Invested
            </span>
            <span role="columnheader" className="num">
              Fee
            </span>
            <span role="columnheader">Status</span>
          </div>
          {rows.map((r, i) => (
            <div className={`row row--${r.state}`} role="row" key={r.id ?? `${r.at}-${i}`} style={{ ['--i' as string]: i }}>
              <span role="cell" className="row__who">
                <span className="row__name">{r.investorLabel}</span>
                <span className="row__meta muted small">{formatDate(r.at)}</span>
              </span>
              <span role="cell" className="row__who">
                <span className="row__name">{r.introducerName}</span>
                <span className="row__meta muted small mono">{r.introducerCode}</span>
              </span>
              <span role="cell" className="num tnum" data-label="Invested">
                {formatUsd(r.subscribed)}
              </span>
              <span role="cell" className="num tnum" data-label="Fee">
                {r.state === 'recovered' ? <s className="muted">{formatUsd(r.feeAccrued)}</s> : formatUsd(r.feeAccrued)}
              </span>
              <span role="cell" className="row__status">
                <StatusPill
                  state={r.state}
                  detail={
                    r.state === 'vesting'
                      ? `vests ${formatDate(r.vestsAt)}`
                      : r.state === 'claimable'
                        ? 'next run'
                        : r.state === 'recovered'
                          ? 'redeemed early'
                          : undefined
                  }
                />
                {r.recoverable && <span className="muted small row__note">recoverable until {formatDate(r.vestsAt)}</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- auditor ------------------------------------------------------ */}
      <section className="card audit" aria-labelledby="audit-h">
        <div className="audit__icon" aria-hidden>
          <ShieldCheckIcon size={20} />
        </div>
        <div className="audit__body">
          {MODE === 'live' ? (
            // Honest copy for live mode: this client holds no auditor key, so
            // the only thing it can reconcile is the fund's ledger against
            // itself. The independent check is the auditor's, not this screen's.
            <>
              <div className="eyebrow">Reconciliation — fund view</div>
              <h2 id="audit-h">No auditor key is held by this client</h2>
              {audit.data ? (
                <p className="muted">
                  Outstanding liability <b className="tnum">{formatUsd(audit.data.statedLiability)}</b>, read from the
                  fund’s own ledger. The independent check — decrypting every confidential settlement with the
                  auditor’s key and comparing the total — runs on the auditor’s side, not in this console.
                </p>
              ) : (
                <p className="muted">Reading…</p>
              )}
            </>
          ) : (
            <>
              <div className="eyebrow">Independent check</div>
              <h2 id="audit-h">{audit.data?.auditor ?? 'Auditor'}</h2>
              {audit.data ? (
                <p className="muted">
                  Decrypted settlements total <b className="tnum">{formatUsd(audit.data.encryptedTotal)}</b> against a stated liability of{' '}
                  <b className="tnum">{formatUsd(audit.data.statedLiability)}</b>.{' '}
                  {audit.data.reconciles ? 'They reconcile.' : 'They do not reconcile.'} The auditor holds a key that opens every settlement,
                  so the fund cannot under-report — and no {role}’s rate or payout becomes public to get there.
                </p>
              ) : (
                <p className="muted">Checking…</p>
              )}
            </>
          )}
        </div>
        <div className={`audit__verdict ${MODE !== 'live' && audit.data?.reconciles ? 'ok' : ''}`}>
          {MODE === 'live' ? 'Fund view' : audit.data?.reconciles ? 'Reconciles' : '—'}
        </div>
      </section>

      <p className="muted small foot">
        <ShieldCheckIcon size={14} /> {MODE === 'live' ? 'Reading the testnet contract' : 'Demo data'} · the chain records who introduced
        whom, how much, and when — never a rate or a fee.
      </p>
    </Shell>
  );
}

function cents(a: string): number {
  const [w, f = '0'] = a.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0').slice(0, 2));
}
function fromCents(c: number): string {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}
