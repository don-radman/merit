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
import { createStubClient, setStubFailure } from '../src/lib/stub.ts';
import { ISSUER_TOTALS, feeOn, addAmounts} from '../src/lib/fixtures.ts';
import type { SubscriptionStage } from '../src/lib/types.ts';

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
eq('book feeClaimable', book.totals.feeClaimable, '8750.00');
eq('trailFeeBps', book.totals.feeAccrued, feeOn(book.totals.subscribedTotal));

// --- 7. claim, then nothing left ------------------------------------------
const claim = await intro.claimFee();
eq('claim amount', claim.amount, '8750.00');
ok('claim generated a proof', claim.provingMs > 2000);

const after = await intro.getBook();
eq('claimable after claim', after.totals.feeClaimable, '0.00');

let nothing = '';
try { await intro.claimFee(); } catch (e: any) { nothing = e.code; }
eq('second claim rejects', nothing, 'nothing-to-claim');

// --- 8. issuer ledger + auditor -------------------------------------------
const issuer = createStubClient({ role: 'issuer' });
const ledger = await issuer.getLedger();
eq('ledger rows', ledger.rows.length, 5);
eq('ledger subscribedTotal', ledger.totals.subscribedTotal, '2750000.00');
eq('ledger introducerCount', ledger.totals.introducerCount, 2);
eq('ledger outstanding', ledger.totals.outstandingFeeLiability, '3000.00');

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
