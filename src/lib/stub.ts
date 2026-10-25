/**
 * Stub client — fake data, real shape, no chain.
 * =========================================================================
 * Build every screen against this. It satisfies the frozen interface exactly,
 * so swapping in the live client later changes one line in `index.ts` and
 * nothing in the UI.
 *
 * It deliberately is not instant and not infallible:
 *   - `generating-proof` waits PROVING_DELAY_MS, so the spinner gets built
 *   - `setStubFailure(code)` arms the next call to fail, so error states do too
 *
 * State lives in memory for the page session. A subscription made on the
 * investor screen shows up in the introducer book and the issuer ledger.
 */

import type {
  Address,
  AttributionLedger,
  AuditorAttestation,
  BookEntry,
  ClaimReceipt,
  ClientConfig,
  ClientError,
  ClientErrorCode,
  HoldingsStatement,
  IntroducerBook,
  IntroducerRailsClient,
  IntroducerCode,
  KycInput,
  KycResult,
  LedgerRow,
  Role,
  SubscribeInput,
  SubscriptionReceipt,
  SubscriptionStage,
  Timestamp,
  Wallet,
} from '@/lib/types.ts';

import { formatAmount } from '@/lib/types.ts';

import {
  AUDITOR,
  FUND,
  INTRODUCERS,
  ISSUER_TOTALS,
  PROVING_DELAY_MS,
  STAGE_DELAY_MS,
  SUBSCRIPTIONS,
  TRAIL_FEE_BPS,
  VESTING_WINDOW_DAYS,
  addAmounts,
  feeOn,
  fromCents,
  linkFor,
  isVested,
  rateFor,
  subtractAmounts,
  toCents,
  unitsFor,
  vestsAtFor,
} from '@/lib/fixtures.ts';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function fail(
  code: ClientErrorCode,
  message: string,
  opts: { retryable?: boolean; details?: Record<string, string> } = {},
): never {
  const err = new Error(message) as ClientError;
  err.code = code;
  err.retryable = opts.retryable ?? false;
  if (opts.details) err.details = opts.details;
  throw err;
}

/** Arm the NEXT client call to reject with this code. Null disarms. */
let armedFailure: ClientErrorCode | null = null;

export function setStubFailure(code: ClientErrorCode | null): void {
  armedFailure = code;
}

function checkArmed(): void {
  if (armedFailure === null) return;
  const code = armedFailure;
  armedFailure = null;
  fail(code, `Stub failure armed: ${code}`, { retryable: code === 'network' });
}

// ---------------------------------------------------------------------------
// Mutable session state
// ---------------------------------------------------------------------------

interface StubSubscription {
  fullName: string;
  label: string;
  countryCode: string;
  introducerCode: IntroducerCode;
  subscribed: string;
  at: Timestamp;
  feeSettled: boolean;
  /** Set for subscriptions made during this session. */
  address?: Address;
}

interface StubState {
  subs: StubSubscription[];
  claimed: Record<IntroducerCode, string>;
  wallet: Wallet | null;
  kyc: KycResult | null;
}

function seed(): StubState {
  return {
    subs: SUBSCRIPTIONS.map((s) => ({ ...s })),
    claimed: Object.fromEntries(INTRODUCERS.map((i) => [i.code, i.feeClaimed])),
    wallet: null,
    kyc: null,
  };
}

let state: StubState = seed();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = (): Timestamp => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const hash = () =>
  Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

function accruedFor(code: IntroducerCode): string {
  return addAmounts(
    ...state.subs
      .filter((s) => s.introducerCode === code)
      .map((s) => feeOn(s.subscribed, rateFor(code))),
  );
}

/** Accrued AND past its vesting window — the only part that can be withdrawn. */
function vestedAccruedFor(code: IntroducerCode): string {
  return addAmounts(
    ...state.subs
      .filter((s) => s.introducerCode === code && isVested(s.at))
      .map((s) => feeOn(s.subscribed, rateFor(code))),
  );
}

function requireRole(role: Role, allowed: Role[]): void {
  if (!allowed.includes(role)) {
    fail('unknown', `This client is scoped to '${role}'; needs one of ${allowed.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

export function createStubClient(config: ClientConfig): IntroducerRailsClient {
  const { role } = config;
  let bookCode = config.code ?? INTRODUCERS[0].code;

  return {
    role,
    mode: 'stub',

    // -- onboarding --------------------------------------------------------

    async createWallet(label?: string): Promise<Wallet> {
      checkArmed();
      await sleep(STAGE_DELAY_MS);
      const suffix = hash().slice(0, 4).toUpperCase();
      state.wallet = {
        address: `C${hash().slice(0, 55).toUpperCase()}`,
        label: label ?? `Passkey · …${suffix}`,
        isNew: true,
      };
      return state.wallet;
    },

    async connectWallet(): Promise<Wallet> {
      checkArmed();
      await sleep(STAGE_DELAY_MS);
      if (!state.wallet) {
        state.wallet = {
          address: `C${hash().slice(0, 55).toUpperCase()}`,
          label: 'Passkey · …7F2A',
          isNew: false,
        };
      }
      return { ...state.wallet, isNew: false };
    },

    async submitKyc(input: KycInput): Promise<KycResult> {
      checkArmed();
      await sleep(STAGE_DELAY_MS * 2);
      state.kyc = {
        status: 'passed',
        reference: `KYC-${hash().slice(0, 8).toUpperCase()}`,
      };
      return state.kyc;
    },

    // -- the link ----------------------------------------------------------

    async resolveCode(code: IntroducerCode) {
      checkArmed();
      await sleep(STAGE_DELAY_MS / 2);
      const found = INTRODUCERS.find((i) => i.code.toLowerCase() === code.toLowerCase());
      if (!found) {
        fail('unknown-code', `No introducer with code ${code}`, { details: { code } });
      }
      return {
        code: found.code,
        displayName: found.displayName,
        fundName: FUND.name,
        minimumSubscription: FUND.minimumSubscription,
      };
    },

    // -- subscribe ---------------------------------------------------------

    async subscribe(input: SubscribeInput): Promise<SubscriptionReceipt> {
      requireRole(role, ['investor']);
      checkArmed();

      const introducer = INTRODUCERS.find(
        (i) => i.code.toLowerCase() === input.code.toLowerCase(),
      );
      if (!introducer) fail('unknown-code', `No introducer with code ${input.code}`);

      if (toCents(input.usdcAmount) < toCents(FUND.minimumSubscription)) {
        fail('below-minimum', `Minimum subscription is ${FUND.minimumSubscription} USDC`, {
          details: { minimum: FUND.minimumSubscription },
        });
      }

      const stage = (s: SubscriptionStage) => input.onStage?.(s);
      const provingStart = Date.now();
      let provingMs = 0;

      const sequence: Array<[SubscriptionStage, number]> = [
        ['awaiting-signature', STAGE_DELAY_MS],
        ['authorizing-trustline', STAGE_DELAY_MS * 2],
        ['transferring-usdc', STAGE_DELAY_MS],
        ['minting-units', STAGE_DELAY_MS],
        ['generating-proof', PROVING_DELAY_MS],
        ['accruing-fee', STAGE_DELAY_MS],
      ];

      for (const [s, ms] of sequence) {
        stage(s);
        if (s === 'generating-proof') {
          const t = Date.now();
          await sleep(ms);
          provingMs = Date.now() - t;
        } else {
          await sleep(ms);
        }
      }

      state.subs.push({
        fullName: state.kyc ? 'You' : 'New investor',
        label: `New subscription · ${new Date().toLocaleTimeString()}`,
        countryCode: 'SG',
        introducerCode: introducer.code,
        subscribed: input.usdcAmount,
        at: now(),
        feeSettled: false,
        address: state.wallet?.address,
      });

      stage('done');

      return {
        units: unitsFor(input.usdcAmount),
        subscribed: input.usdcAmount,
        unitPrice: FUND.unitPrice,
        introducer: { code: introducer.code, displayName: introducer.displayName },
        txHash: hash(),
        at: now(),
        provingMs: provingMs || Date.now() - provingStart,
      };
    },

    async getHoldings(address?: Address): Promise<HoldingsStatement> {
      checkArmed();
      await sleep(STAGE_DELAY_MS / 2);
      const target = address ?? state.wallet?.address;
      const mine = state.subs.filter((s) => s.address && s.address === target);
      const source = mine.length > 0 ? mine : [state.subs[0]];

      const subscribedTotal = addAmounts(...source.map((s) => s.subscribed));
      const units = unitsFor(subscribedTotal);
      const valueUsd = fromCents(
        Math.round((toCents(units) * toCents(FUND.unitPrice)) / 100),
      );

      return {
        fundName: FUND.name,
        unitCode: FUND.unitCode,
        units,
        unitPrice: FUND.unitPrice,
        valueUsd,
        subscribedTotal,
        firstSubscribedAt: source[0].at,
        issuerControls: {
          trustlineAuthorized: true,
          freezeEnabled: true,
          clawbackEnabled: true,
        },
        summary: [
          `You hold ${formatAmount(units)} units of the ${FUND.name}.`,
          `Each unit is currently valued at ${formatAmount(FUND.unitPrice)} USD, so your holding is worth about ${formatAmount(valueUsd)} USD.`,
          `You subscribed ${formatAmount(subscribedTotal)} USDC in total. Units were issued directly to your passkey wallet.`,
          `This fund is a regulated-asset structure: the issuer approved your account before units could be issued, and can freeze or recall units under its normal compliance controls.`,
          `The person who introduced you is paid a fee by the fund, not by you. You never see their fee and they never see your balance.`,
        ],
      };
    },

    // -- book --------------------------------------------------------------

    async registerIntroducer(input: { displayName: string }) {
      checkArmed();
      await sleep(STAGE_DELAY_MS);
      const code = `CALDER-${hash().slice(0, 3).toUpperCase()}`;
      // A new introducer starts on the default rate until the issuer
      // negotiates one with them. The rate never reaches the chain.
      INTRODUCERS.push({
        code,
        displayName: input.displayName,
        trailFeeBps: TRAIL_FEE_BPS,
        feeClaimed: '0.00',
      });
      state.claimed[code] = '0.00';
      bookCode = code;
      return { code, link: linkFor(code) };
    },

    async getBook(): Promise<IntroducerBook> {
      requireRole(role, ['introducer']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const introducer =
        INTRODUCERS.find((i) => i.code === bookCode) ?? INTRODUCERS[0];
      const mine = state.subs.filter((s) => s.introducerCode === introducer.code);

      const entries: BookEntry[] = mine.map((s) => ({
        investorLabel: s.label,
        subscribed: s.subscribed,
        at: s.at,
        feeAccrued: feeOn(s.subscribed, rateFor(introducer.code)),
        vestsAt: vestsAtFor(s.at),
        vested: isVested(s.at),
        // Only these two. The stub keeps claims as a running total per
        // introducer, not against a row, so it cannot say which row was the
        // one claimed — and it has no clawback model at all.
        state: isVested(s.at) ? ('claimable' as const) : ('vesting' as const),
      }));

      const feeAccrued = accruedFor(introducer.code);
      const feeVested = vestedAccruedFor(introducer.code);
      const feeClaimed = state.claimed[introducer.code] ?? '0.00';

      return {
        code: introducer.code,
        displayName: introducer.displayName,
        trailFeeBps: rateFor(introducer.code),
        vestingWindowDays: VESTING_WINDOW_DAYS,
        entries,
        totals: {
          introducedCount: entries.length,
          subscribedTotal: addAmounts(...mine.map((s) => s.subscribed)),
          feeAccrued,
          feeClaimed,
          // vested minus claimed, NOT accrued minus claimed
          feeClaimable: subtractAmounts(feeVested, feeClaimed),
          feeVesting: subtractAmounts(feeAccrued, feeVested),
        },
      };
    },

    async claimFee(): Promise<ClaimReceipt> {
      requireRole(role, ['introducer']);
      checkArmed();

      const code = bookCode;
      const claimed = state.claimed[code] ?? '0.00';
      const claimable = subtractAmounts(vestedAccruedFor(code), claimed);

      if (toCents(claimable) <= 0) {
        // Distinguish "you have earned nothing" from "you have earned something
        // that has not vested" — they are different sentences on screen.
        const unclaimedAccrued = subtractAmounts(accruedFor(code), claimed);
        if (toCents(unclaimedAccrued) > 0) {
          fail(
            'not-yet-vested',
            `Fee accrued but still inside its ${VESTING_WINDOW_DAYS}-day window`,
            { details: { vesting: unclaimedAccrued, windowDays: String(VESTING_WINDOW_DAYS) } },
          );
        }
        fail('nothing-to-claim', 'No accrued fee available to claim');
      }

      const t = Date.now();
      await sleep(PROVING_DELAY_MS);
      const provingMs = Date.now() - t;
      await sleep(STAGE_DELAY_MS);

      state.claimed[code] = addAmounts(claimed, claimable);
      state.subs = state.subs.map((s) =>
        s.introducerCode === code && isVested(s.at) ? { ...s, feeSettled: true } : s,
      );

      return { amount: claimable, txHash: hash(), at: now(), provingMs };
    },

    // -- ledger ------------------------------------------------------------

    async getLedger(): Promise<AttributionLedger> {
      requireRole(role, ['issuer', 'auditor']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const rows: LedgerRow[] = state.subs.map((s) => {
        const introducer = INTRODUCERS.find((i) => i.code === s.introducerCode);
        return {
          investorLabel: s.label,
          introducerCode: s.introducerCode,
          introducerName: introducer?.displayName ?? s.introducerCode,
          subscribed: s.subscribed,
          units: unitsFor(s.subscribed),
          at: s.at,
          feeAccrued: feeOn(s.subscribed, rateFor(s.introducerCode)),
          feeSettled: s.feeSettled,
          vestsAt: vestsAtFor(s.at),
          // The issuer can still recover a fee that has accrued, not vested
          // and not been paid out.
          recoverable: !isVested(s.at) && !s.feeSettled,
        };
      });

      const subscribedTotal = addAmounts(...rows.map((r) => r.subscribed));
      const feeAccruedTotal = addAmounts(...rows.map((r) => r.feeAccrued));
      const feesSettledTotal = addAmounts(...Object.values(state.claimed));

      return {
        fundName: FUND.name,
        rows,
        totals: {
          investorCount: rows.length,
          introducerCount: new Set(rows.map((r) => r.introducerCode)).size,
          subscribedTotal,
          unitsIssued: unitsFor(subscribedTotal),
          outstandingFeeLiability: subtractAmounts(feeAccruedTotal, feesSettledTotal),
          feesSettledTotal,
          feeVestingTotal: addAmounts(
            ...rows.filter((r) => !isVested(r.at)).map((r) => r.feeAccrued),
          ),
        },
      };
    },

    async getAuditorAttestation(): Promise<AuditorAttestation> {
      requireRole(role, ['issuer', 'auditor']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const feeAccruedTotal = addAmounts(
        ...state.subs.map((s) => feeOn(s.subscribed, rateFor(s.introducerCode))),
      );
      const feesSettledTotal = addAmounts(...Object.values(state.claimed));
      const outstanding = subtractAmounts(feeAccruedTotal, feesSettledTotal);

      return {
        encryptedTotal: outstanding,
        statedLiability: outstanding,
        reconciles: true,
        checkedAt: now(),
        auditor: AUDITOR,
      };
    },

    // -- demo plumbing -----------------------------------------------------

    async resetDemo(): Promise<void> {
      INTRODUCERS.length = 2;
      state = seed();
      armedFailure = null;
      bookCode = config.code ?? INTRODUCERS[0].code;
    },
  };
}

/** Exported for the smoke test and for a dev panel, if you build one. */
export const stubTotals = ISSUER_TOTALS;
