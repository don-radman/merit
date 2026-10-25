/**
 * Screen 2 of 3 — NOT BUILT YET. This is the spec, not the screen.
 *
 * Build against `createClient({ role: 'introducer', code })`:
 *
 *   getBook()    -> IntroducerBook  { entries[], totals, trailFeeBps }
 *   claimFee()   -> ClaimReceipt    { amount, txHash, provingMs }
 *
 * Shows this introducer's own book and nothing else: who they introduced, how
 * much each subscribed, fee accrued per entry, and a claim button for
 * `totals.feeClaimable`.
 *
 * VESTING. `feeClaimable` is **vested minus claimed**, not accrued minus
 * claimed. Three figures belong on screen, and conflating them is the easiest
 * way to get this screen wrong:
 *
 *   totals.feeAccrued   everything earned
 *   totals.feeClaimable what the button pays out now
 *   totals.feeVesting   earned, not yet withdrawable
 *
 * Per entry, `vested` and `vestsAt` say which bucket it is in. Read `vested`
 * rather than comparing `vestsAt` to the browser clock. Disable the claim
 * button when `feeClaimable` is zero and say when the rest becomes available —
 * the seeded data always has one introducer in each state, so both cases are
 * on screen without arming anything.
 *
 * Two things to get right:
 *   - `claimFee()` generates a proof, so it is a multi-second wait. Reuse the
 *     spinner-with-copy pattern from InvestorSubscribe rather than a bare one.
 *   - the fee figures are confidential — decrypted for this introducer only.
 *     Do not log them and do not put them in a URL.
 *
 * Arm `nothing-to-claim` and `proof-failed` from the dev bar before calling it
 * done.
 */
export default function IntroducerBook() {
  return (
    <main className="page">
      <div className="eyebrow">Screen 2 of 3</div>
      <h1>My book</h1>
      <p className="muted">
        Not built yet. The spec is in the comment at the top of this file, and
        the data shape is <code>IntroducerBook</code> in{' '}
        <code>src/lib/types.ts</code>.
      </p>
    </main>
  );
}
