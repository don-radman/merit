/**
 * Screen 3 of 3 — NOT BUILT YET. This is the spec, not the screen.
 *
 * Build against `createClient({ role: 'issuer' })`:
 *
 *   getLedger()              -> AttributionLedger   { rows[], totals }
 *   getAuditorAttestation()  -> AuditorAttestation  { reconciles, totals }
 *
 * Every attribution across all introducers, plus `outstandingFeeLiability` —
 * the figure a CFO actually cares about. Wide layout: use `.page--wide`.
 *
 * Put the auditor reconciliation line at the bottom: encrypted total vs stated
 * liability, and whether they match. It is three lines of markup and it is the
 * clearest demonstration on any screen that the privacy is real rather than
 * just hidden data — totals reconcile through the auditor's view key without
 * any individual position being public.
 *
 * First to be cut if time runs short: a static screenshot of this in the demo
 * video is acceptable. The other two screens are not.
 */
export default function IssuerLedger() {
  return (
    <main className="page page--wide">
      <div className="eyebrow">Screen 3 of 3</div>
      <h1>Attribution ledger</h1>
      <p className="muted">
        Not built yet. The spec is in the comment at the top of this file, and
        the data shapes are <code>AttributionLedger</code> and{' '}
        <code>AuditorAttestation</code> in <code>src/lib/types.ts</code>.
      </p>
    </main>
  );
}
