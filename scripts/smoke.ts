/**
 * Contract smoke test — `npm run smoke`
 * =========================================================================
 * Drives the whole flow through the client interface: resolve a code,
 * onboard, subscribe, read the statement, read the book, claim the fee, read
 * the issuer ledger, check the auditor reconciliation, then reset.
 *
 * Two reasons to keep it:
 *   1. It checks the fee arithmetic in `fixtures.ts`. Wrong numbers on screen
 *      during the demo is a worse bug than a crash.
 *   2. When `live.ts` exists, point the two `createStubClient` calls at
 *      `createClient` and this becomes the integration test — it proves the
 *      live client honours the frozen interface the UI was built against.
 *
 * Runs on plain node (>=23, native TS). No install, no chain, no browser.
 */
import { createStubClient, setStubFailure } from '@/lib/stub.ts';
import { ISSUER_TOTALS, feeOn, addAmounts} from '@/lib/fixtures.ts';
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
eq('feeOn 1,000,000 @ 50bps', feeOn('1000000.00'), '5000.00');
eq('feeOn 250,000 @ 50bps', feeOn('250000.00'), '1250.00');
eq('totals.subscribedTotal', ISSUER_TOTALS.subscribedTotal, '2250000.00');
eq('totals.feeAccruedTotal', ISSUER_TOTALS.feeAccruedTotal, '11250.00');
eq('totals.feesSettledTotal', ISSUER_TOTALS.feesSettledTotal, '2000.00');
eq('totals.outstandingLiability', ISSUER_TOTALS.outstandingFeeLiability, '9250.00');
eq('totals.unitsIssued', ISSUER_TOTALS.unitsIssued, '2250000.00');
eq('addAmounts carries cents', addAmounts('0.70', '0.40'), '1.10');

// --- 1b. formatters (Intl, string input, pinned locale) -------------------
eq('formatAmount groups', formatAmount('2750000.00'), '2,750,000.00');
eq('formatAmount keeps 2dp', formatAmount('0.70'), '0.70');
eq('formatAmount negative', formatAmount('-8750.00'), '-8,750.00');
eq('formatAmount exact past 2^53', formatAmount('9007199254740993.99'), '9,007,199,254,740,993.99');
eq('formatUsd', formatUsd('250000.00'), '$250,000.00');

// --- 2. resolveCode --------------------------------------------------------
const investor = createStubClient({ role: 'investor' });
const resolved = await investor.resolveCode('calder-pr7');
eq('resolveCode is case-insensitive', resolved.code, 'CALDER-PR7');
eq('resolveCode returns fund', resolved.fundName, 'Calder Short-Duration Income Fund');

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
await investor.submitKyc({ fullName: 'Test', countryCode: 'SG', category: 'family-office' });

const stages: SubscriptionStage[] = [];
const t0 = Date.now();
const receipt = await investor.subscribe({
  code: 'CALDER-PR7',
  usdcAmount: '500000.00',
  onStage: (s) => stages.push(s),
});
const elapsed = Date.now() - t0;

eq('stage sequence', stages.join(','),
  'awaiting-signature,authorizing-trustline,transferring-usdc,minting-units,generating-proof,accruing-fee,done');
eq('receipt units', receipt.units, '500000.00');
eq('receipt subscribed', receipt.subscribed, '500000.00');
eq('receipt introducer', receipt.introducer.displayName, 'Raghunathan Family Office');
ok('provingMs is a real wait (>2s)', receipt.provingMs > 2000);
ok('txHash looks like a hash', /^[0-9a-f]{64}$/.test(receipt.txHash));
console.log(`    subscribe took ${elapsed}ms, proving ${receipt.provingMs}ms`);

const holdings = await investor.getHoldings();
eq('holdings units', holdings.units, '500000.00');
eq('holdings value', holdings.valueUsd, '500000.00');
ok('statement has plain-English lines', holdings.summary.length >= 4);

// --- 5. role scoping -------------------------------------------------------
let roleErr = '';
try { await investor.getLedger(); } catch (e: any) { roleErr = e.code; }
eq('investor cannot read ledger', roleErr, 'unknown');

// --- 6. introducer book sees the new subscription --------------------------
const intro = createStubClient({ role: 'introducer', code: 'CALDER-PR7' });
const book = await intro.getBook();
eq('book entry count', book.entries.length, 4);
eq('book subscribedTotal', book.totals.subscribedTotal, '2150000.00');
eq('book feeAccrued', book.totals.feeAccrued, '10750.00');
eq('book feeClaimed', book.totals.feeClaimed, '2000.00');
eq('book feeClaimable is VESTED - claimed', book.totals.feeClaimable, '4250.00');
eq('book feeVesting', book.totals.feeVesting, '4500.00');
eq('book vestingWindowDays', book.totals ? book.vestingWindowDays : 0, 90);
eq('entries carry vesting', book.entries.every((e) => typeof e.vested === 'boolean' && !!e.vestsAt), true);
eq('some vested, some not', new Set(book.entries.map((e) => e.vested)).size, 2);
eq('trailFeeBps', book.totals.feeAccrued, feeOn(book.totals.subscribedTotal));

// --- 7. claim, then nothing left ------------------------------------------
const claim = await intro.claimFee();
eq('claim pays only the vested part', claim.amount, '4250.00');
ok('claim generated a proof', claim.provingMs > 2000);

const after = await intro.getBook();
eq('claimable after claim', after.totals.feeClaimable, '0.00');

let nothing = '';
try { await intro.claimFee(); } catch (e: any) { nothing = e.code; }
eq('second claim rejects as not-yet-vested', nothing, 'not-yet-vested');

// An introducer whose every fee is still inside the window.
const intro2 = createStubClient({ role: 'introducer', code: 'CALDER-DO2' });
const book2 = await intro2.getBook();
eq('DO2 has nothing claimable', book2.totals.feeClaimable, '0.00');
eq('DO2 has it all vesting', book2.totals.feeVesting, '3000.00');
let do2 = '';
try { await intro2.claimFee(); } catch (e: any) { do2 = e.code; }
eq('DO2 claim rejects as not-yet-vested', do2, 'not-yet-vested');

// --- 8. issuer ledger + auditor -------------------------------------------
const issuer = createStubClient({ role: 'issuer' });
const ledger = await issuer.getLedger();
eq('ledger rows', ledger.rows.length, 5);
eq('ledger subscribedTotal', ledger.totals.subscribedTotal, '2750000.00');
eq('ledger introducerCount', ledger.totals.introducerCount, 2);
eq('ledger outstanding', ledger.totals.outstandingFeeLiability, '7500.00');
eq('ledger feeVestingTotal', ledger.totals.feeVestingTotal, '7500.00');
eq('issuer can recover unvested rows', ledger.rows.filter((r) => r.recoverable).length, 3);

const att = await issuer.getAuditorAttestation();
ok('auditor reconciles', att.reconciles);
eq('auditor total matches ledger', att.encryptedTotal, ledger.totals.outstandingFeeLiability);

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

// --- 10. reset ------------------------------------------------------------
await issuer.resetDemo();
const reseeded = await issuer.getLedger();
eq('reset restores row count', reseeded.rows.length, 4);
eq('reset restores liability', reseeded.totals.outstandingFeeLiability, '9250.00');

// --- report ---------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\n  FAILURES:\n  - ' + fails.join('\n  - ') + '\n'); process.exit(1); }
console.log('  stub client OK\n');
