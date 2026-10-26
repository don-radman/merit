/**
 * Contract smoke test — `npm run smoke`
 * =========================================================================
 * Drives the whole flow through the client interface: resolve a code,
 * onboard, subscribe, read the statement, read the book, run the fund's
 * payout, read the issuer ledger, check the auditor reconciliation, then
 * reset.
 *
 * Two reasons to keep it:
 *   1. It checks the fee arithmetic in `fixtures.ts`. Wrong numbers on screen
 *      during the demo is a worse bug than a crash.
 *   2. Point the two `createStubClient` calls at `createClient` and this
 *      becomes the integration test — it proves the live client honours the
 *      frozen interface the UI was built against.
 *
 * Runs on plain node (>=23, native TS). No install, no chain, no browser.
 */
import { createStubClient, setStubFailure, stubAdvanceVesting } from '@/lib/stub.ts';
import { ISSUER_TOTALS, feeOn, addAmounts } from '@/lib/fixtures.ts';
import type { SubscriptionStage } from '@/lib/types.ts';
import { formatAmount, formatUsd } from '@/lib/types.ts';

let pass = 0;
const fails: string[] = [];

function eq(label: string, actual: unknown, expected: unknown) {
  if (String(actual) === String(expected)) { pass++; }
  else { fails.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`); }
}
function ok(label: string, cond: boolean) { eq(label, cond, true); }

// --- 1. fixture arithmetic -------------------------------------------------
// Five seeded rows: four earning (250k, 1m, 400k on PR7 at 50 bps; 600k on
// DO2 at 70 bps) and one clawed back (180k on PR7), which counts for nothing.
eq('feeOn 1,000,000 @ 50bps', feeOn('1000000.00'), '5000.00');
eq('feeOn 250,000 @ 50bps', feeOn('250000.00'), '1250.00');
eq('totals.subscribedTotal excludes the reversed row', ISSUER_TOTALS.subscribedTotal, '2250000.00');
eq('totals.feeAccruedTotal', ISSUER_TOTALS.feeAccruedTotal, '12450.00');
eq('totals.feesSettledTotal = the one paid row', ISSUER_TOTALS.feesSettledTotal, '1250.00');
eq('totals.outstandingLiability', ISSUER_TOTALS.outstandingFeeLiability, '11200.00');
eq('totals.unitsIssued', ISSUER_TOTALS.unitsIssued, '2250000.00');
eq('totals.investorCount excludes the reversed row', ISSUER_TOTALS.investorCount, 4);
eq('addAmounts carries cents', addAmounts('0.70', '0.40'), '1.10');

// --- 1b. formatters (Intl, string input, pinned locale) -------------------
eq('formatAmount groups', formatAmount('2750000.00'), '2,750,000.00');
eq('formatAmount keeps 2dp', formatAmount('0.70'), '0.70');
eq('formatAmount negative', formatAmount('-8750.00'), '-8,750.00');
eq('formatAmount exact past 2^53', formatAmount('9007199254740993.99'), '9,007,199,254,740,993.99');
eq('formatUsd says US$, not $', formatUsd('250000.00'), 'US$250,000.00');

// --- 2. resolveCode --------------------------------------------------------
const investor = createStubClient({ role: 'investor' });
const resolved = await investor.resolveCode('calder-pr7');
eq('resolveCode is case-insensitive', resolved.code, 'CALDER-PR7');
eq('resolveCode returns fund', resolved.fundName, 'Calder Short‑Duration Income Fund');

let unknownCode = '';
try { await investor.resolveCode('NOPE-123'); }
catch (e: any) { unknownCode = e.code; }
eq('unknown code rejects', unknownCode, 'unknown-code');

// --- 3. below minimum ------------------------------------------------------
let belowMin = '';
try { await investor.subscribe({ code: 'CALDER-PR7', usdcAmount: '1000.00' }); }
catch (e: any) { belowMin = e.code; }
eq('below minimum rejects', belowMin, 'below-minimum');

// --- 4. full subscribe flow ------------------------------------------------
await investor.createWallet();
await investor.submitKyc({ fullName: 'Tomas Lindqvist', countryCode: 'SG', category: 'family-office' });

const stages: SubscriptionStage[] = [];
const t0 = Date.now();
const receipt = await investor.subscribe({
  code: 'CALDER-PR7',
  usdcAmount: '500000.00',
  onStage: (s) => stages.push(s),
});
const elapsed = Date.now() - t0;

// No 'generating-proof' — the investor path proves nothing. See stub.ts.
eq('stage sequence', stages.join(','),
  'awaiting-signature,authorizing-trustline,transferring-usdc,minting-units,accruing-fee,done');
eq('receipt units', receipt.units, '500000.00');
eq('receipt subscribed', receipt.subscribed, '500000.00');
eq('receipt introducer', receipt.introducer.displayName, 'Raghunathan Family Office');
eq('no proof on the investor path', receipt.provingMs, 0);
ok('investor flow is quick (<5s)', elapsed < 5000);
ok('txHash looks like a hash', /^[0-9a-f]{64}$/.test(receipt.txHash));
console.log(`    subscribe took ${elapsed}ms`);

const holdings = await investor.getHoldings();
eq('holdings units', holdings.units, '500000.00');
eq('holdings value', holdings.valueUsd, '500000.00');
ok('statement has plain-English lines', holdings.summary.length >= 4);

// --- 5. role scoping -------------------------------------------------------
let roleErr = '';
try { await investor.getLedger(); } catch (e: any) { roleErr = e.code; }
eq('investor cannot read ledger', roleErr, 'unknown');

// --- 6. the scout's book sees the new subscription -------------------------
const intro = createStubClient({ role: 'introducer', code: 'CALDER-PR7' });
const book = await intro.getBook();
eq('book entry count (incl. the reversed row)', book.entries.length, 5);
eq('book introducedCount excludes reversed', book.totals.introducedCount, 4);
eq('book subscribedTotal', book.totals.subscribedTotal, '2150000.00');
eq('book feeAccrued', book.totals.feeAccrued, '10750.00');
eq('book feeClaimed = paid rows', book.totals.feeClaimed, '1250.00');
eq('book feeClaimable is VESTED - paid', book.totals.feeClaimable, '5000.00');
eq('book feeVesting', book.totals.feeVesting, '4500.00');
eq('book vestingWindowDays', book.vestingWindowDays, 90);
eq('seeded scout has payouts set up', book.payoutsReady, true);
// The rate is negotiated per introducer and is never on chain. If every
// introducer shared one rate, "private rate" would be refuted by a grep.
eq('PR7 has its own rate', book.trailFeeBps, 50);
eq('entries carry vesting', book.entries.every((e) => typeof e.vested === 'boolean' && !!e.vestsAt), true);
eq('every entry has a state', book.entries.every((e) => !!e.state), true);
eq('all four states appear', new Set(book.entries.map((e) => e.state)).size, 4);
const newRow = book.entries.find((e) => e.investorLabel === 'T. Lindqvist · Singapore');
eq('new row is labelled from KYC', newRow?.investorLabel, 'T. Lindqvist · Singapore');
eq('new row is vesting', newRow?.state, 'vesting');
eq('new row lands at the top of the book', book.entries[0]?.investorLabel, 'T. Lindqvist · Singapore');
eq('trailFeeBps', book.totals.feeAccrued, feeOn(book.totals.subscribedTotal));

// --- 7. collect now, then nothing left -------------------------------------
const claim = await intro.claimFee();
eq('collect pays only the vested part', claim.amount, '5000.00');
eq('collect is a marking tx, no proof', claim.provingMs, 0);

const after = await intro.getBook();
eq('claimable after collect', after.totals.feeClaimable, '0.00');
eq('paid row is marked', after.entries.filter((e) => e.state === 'claimed').length, 2);

let nothing = '';
try { await intro.claimFee(); } catch (e: any) { nothing = e.code; }
eq('second collect rejects as not-yet-vested', nothing, 'not-yet-vested');

// A scout whose every fee is still inside the window.
const intro2 = createStubClient({ role: 'introducer', code: 'CALDER-DO2' });
const book2 = await intro2.getBook();
eq('DO2 has nothing claimable', book2.totals.feeClaimable, '0.00');
eq('DO2 has it all vesting', book2.totals.feeVesting, '4200.00');
eq('DO2 has a DIFFERENT rate from PR7', book2.trailFeeBps, 70);
eq('rates actually differ', book.trailFeeBps !== book2.trailFeeBps, true);
let do2 = '';
try { await intro2.claimFee(); } catch (e: any) { do2 = e.code; }
eq('DO2 collect rejects as not-yet-vested', do2, 'not-yet-vested');

// --- 8. issuer ledger + payout run + auditor -------------------------------
const issuer = createStubClient({ role: 'issuer' });
const ledger = await issuer.getLedger();
eq('ledger rows (incl. reversed)', ledger.rows.length, 6);
eq('ledger subscribedTotal', ledger.totals.subscribedTotal, '2750000.00');
eq('ledger introducerCount', ledger.totals.introducerCount, 2);
eq('ledger outstanding', ledger.totals.outstandingFeeLiability, '8700.00');
eq('ledger feeVestingTotal', ledger.totals.feeVestingTotal, '8700.00');
eq('issuer can recover unvested rows', ledger.rows.filter((r) => r.recoverable).length, 3);
eq('ledger rows carry state', ledger.rows.every((r) => !!r.state), true);

// Nothing is ready, so the payout run is a quiet receipt.
const quiet = await issuer.runSettlement!();
eq('payout run with nothing ready settles 0', quiet.settledCount, 0);

// Vest everything, then the run pays both scouts in one go.
stubAdvanceVesting();
const run = await issuer.runSettlement!();
eq('payout run settles every vested row', run.settledCount, 3);
eq('payout run paid two scouts', run.introducerCount, 2);
ok('payout run is a real wait (issuer proof)', run.provingMs > 1000);

const settled = await issuer.getLedger();
eq('ledger outstanding after run', settled.totals.outstandingFeeLiability, '0.00');
const att = await issuer.getAuditorAttestation();
ok('auditor reconciles', att.reconciles);
eq('auditor total matches ledger', att.encryptedTotal, settled.totals.outstandingFeeLiability);

// --- 9. armed failures ----------------------------------------------------
setStubFailure('passkey-declined');
let armed = '';
try { await investor.createWallet(); } catch (e: any) { armed = e.code; }
eq('armed failure fires', armed, 'passkey-declined');
await investor.createWallet();
eq('armed failure is one-shot', 'recovered', 'recovered');

setStubFailure('network');
let retryable = false;
try { await investor.connectWallet(); } catch (e: any) { retryable = e.retryable; }
ok('network errors are retryable', retryable);

// --- 10. payout setup for a new scout --------------------------------------
const fresh = createStubClient({ role: 'introducer' });
const { code: newCode } = await fresh.registerIntroducer({ displayName: 'Harbourline Advisory' });
ok('new code minted', /^CALDER-[A-Z0-9]{3}$/.test(newCode));
eq('new scout has payouts NOT set up', (await fresh.getBook()).payoutsReady, false);
await fresh.setUpPayouts!();
eq('setup flips the flag', (await fresh.getBook()).payoutsReady, true);

// --- 11. reset ------------------------------------------------------------
await issuer.resetDemo();
const reseeded = await issuer.getLedger();
eq('reset restores row count', reseeded.rows.length, 5);
eq('reset restores liability', reseeded.totals.outstandingFeeLiability, '11200.00');

// --- report ---------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\n  FAILURES:\n  - ' + fails.join('\n  - ') + '\n'); process.exit(1); }
console.log('  stub client OK\n');
