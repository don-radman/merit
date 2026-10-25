/**
 * Stub client — fake data, real shape, no chain.
 * =========================================================================
 * Build every screen against this. It satisfies the frozen interface exactly,
 * so swapping in the live client later changes one line in `index.ts` and
 * nothing in the UI.
 *
 * It deliberately is not instant and not infallible:
 *   - the issuer's payout run waits SETTLEMENT_PROVING_MS, so the beat where
 *     the fund proves and settles gets a real spinner with real copy
 *   - `setStubFailure(code)` arms the next call to fail, so error states do too
 *
 * WHERE THE PROOF LIVES. The investor's subscribe generates no proof — the
 * contract records attribution in the clear, by design (DECISIONS.md D10). The
 * proof belongs to the ISSUER's confidential settlement, so that is the only
 * place this stub spends proving time. An earlier version put a six-second
 * "sealing your fee" stage in the investor flow; that was the hour-0 design
 * and it was fiction. The stage id still exists in the type and is never
 * emitted.
 *
 * State lives in memory for the page session. A subscription made on the
 * investor screen shows up in the scout's book and the issuer's ledger.
 * Settlement is tracked PER ROW, so the book can say which introduction paid.
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
  SettlementReceipt,
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
  SETTLEMENT_PROVING_MS,
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
  id: string;
  fullName: string;
  label: string;
  countryCode: string;
  introducerCode: IntroducerCode;
  subscribed: string;
  at: Timestamp;
  feeSettled: boolean;
  paidAt?: Timestamp;
  recovered?: boolean;
  /** Set for subscriptions made during this session. */
  address?: Address;
}

interface StubState {
  subs: StubSubscription[];
  wallet: Wallet | null;
  kyc: KycResult | null;
  /** What the investor typed, so their row on the book has a real label. */
  kycInput?: KycInput;
  /** One-time payout setup, per introducer code. */
  payoutsReady: Record<IntroducerCode, boolean>;
  nextId: number;
}

function seed(): StubState {
  return {
    subs: SUBSCRIPTIONS.map((s, i) => ({
      ...s,
      id: String(i + 1),
      paidAt: s.feeSettled ? s.vestsAt : undefined,
    })),
    wallet: null,
    kyc: null,
    // Seeded scouts have been paid before, so they are set up. A brand-new
    // scout (registerIntroducer) starts false and sees the setup card.
    payoutsReady: Object.fromEntries(INTRODUCERS.map((i) => [i.code, true])),
    nextId: SUBSCRIPTIONS.length + 1,
  };
}

// ---------------------------------------------------------------------------
// Persistence across tabs
// ---------------------------------------------------------------------------
//
// The demo's best beat is the scout's book updating the moment the investor
// finishes — in a second window, phone-framed, side by side. In-memory state
// is per tab, so the stub mirrors itself to localStorage and listens for the
// `storage` event the other tab fires. Screens subscribe with `onStubChange`
// and refetch. Outside a browser (the smoke test) none of this exists and the
// stub is plain memory.

const STORAGE_KEY = 'introducer-rails:stub:v1';
const CHANGE_EVENT = 'introducer-rails:stub-changed';
const hasWindow = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function hydrate(): StubState {
  if (!hasWindow) return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StubState;
  } catch {
    /* corrupt or blocked storage: start fresh */
  }
  return seed();
}

function announce(): void {
  if (!hasWindow) return;
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

function persist(): void {
  if (hasWindow) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode or quota: the current tab still works */
    }
  }
  announce();
}

let state: StubState = hydrate();

if (hasWindow) {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = hydrate();
    announce();
  });
}

/** Subscribe to stub changes from this tab or another. Returns an unsubscribe. */
export function onStubChange(cb: () => void): () => void {
  if (!hasWindow) return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = (): Timestamp => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const hash = () =>
  Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

/** Rows that earn for this code: not clawed back. */
function earningFor(code: IntroducerCode): StubSubscription[] {
  return state.subs.filter((s) => s.introducerCode === code && !s.recovered);
}

function sumFees(rows: StubSubscription[]): string {
  return addAmounts(...rows.map((s) => feeOn(s.subscribed, rateFor(s.introducerCode))));
}

function accruedFor(code: IntroducerCode): string {
  return sumFees(earningFor(code));
}

/** Accrued AND past its vesting window — the only part that can be paid. */
function vestedAccruedFor(code: IntroducerCode): string {
  return sumFees(earningFor(code).filter((s) => isVested(s.at)));
}

function settledFor(code: IntroducerCode): string {
  return sumFees(earningFor(code).filter((s) => s.feeSettled));
}

function stateOf(s: StubSubscription): NonNullable<BookEntry['state']> {
  if (s.recovered) return 'recovered';
  if (s.feeSettled) return 'claimed';
  return isVested(s.at) ? 'claimable' : 'vesting';
}

/** "Thomas Brandt-Nilsen", "SG" -> "T. Brandt-Nilsen · Singapore" */
function labelFor(fullName: string, countryCode: string): string {
  const parts = fullName.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  const initial = parts[0]?.[0] ? `${parts[0][0]}. ` : '';
  const country =
    ({ SG: 'Singapore', AU: 'Australia', NZ: 'New Zealand', GB: 'United Kingdom' } as Record<string, string>)[
      countryCode
    ] ?? countryCode;
  return `${initial}${surname} · ${country}`;
}

function requireRole(role: Role, allowed: Role[]): void {
  if (!allowed.includes(role)) {
    fail('unknown', `This client is scoped to '${role}'; needs one of ${allowed.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Dev-only levers, for the demo bar
// ---------------------------------------------------------------------------

/**
 * Pretend the window has passed for every vesting row, so "Ready" and the
 * payout run can be shown without waiting 90 days. Shifts `at` back by the
 * window plus a day; recovered and settled rows are left alone.
 */
export function stubAdvanceVesting(): void {
  const shift = (VESTING_WINDOW_DAYS + 1) * 86_400_000;
  state.subs = state.subs.map((s) =>
    s.recovered || s.feeSettled || isVested(s.at)
      ? s
      : { ...s, at: new Date(Date.parse(s.at) - shift).toISOString().replace(/\.\d{3}Z$/, 'Z') },
  );
  persist();
}

/** Show or hide the one-time "Set up payouts" card for a code. */
export function setStubPayoutsReady(code: IntroducerCode, ready: boolean): void {
  state.payoutsReady[code] = ready;
  persist();
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
      persist();
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
      // Remember who, so the scout's book can show a real-looking label.
      state.kycInput = input;
      persist();
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

      // No 'generating-proof' here, on purpose — see the file comment. The
      // issuer authorising the investor's account is the one real wait.
      const sequence: Array<[SubscriptionStage, number]> = [
        ['awaiting-signature', STAGE_DELAY_MS],
        ['authorizing-trustline', STAGE_DELAY_MS * 3],
        ['transferring-usdc', STAGE_DELAY_MS],
        ['minting-units', STAGE_DELAY_MS],
        ['accruing-fee', STAGE_DELAY_MS],
      ];

      for (const [s, ms] of sequence) {
        stage(s);
        await sleep(ms);
      }

      const fullName = state.kycInput?.fullName?.trim() || 'New investor';
      const countryCode = state.kycInput?.countryCode ?? 'SG';

      state.subs.push({
        id: String(state.nextId++),
        fullName,
        label: labelFor(fullName, countryCode),
        countryCode,
        introducerCode: introducer.code,
        subscribed: input.usdcAmount,
        at: now(),
        feeSettled: false,
        address: state.wallet?.address,
      });
      persist();

      stage('done');

      return {
        units: unitsFor(input.usdcAmount),
        subscribed: input.usdcAmount,
        unitPrice: FUND.unitPrice,
        introducer: { code: introducer.code, displayName: introducer.displayName },
        txHash: hash(),
        at: now(),
        // Honest zero: nothing was proved on this path.
        provingMs: 0,
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
          `You subscribed ${formatAmount(subscribedTotal)} USDC in total. Units were issued directly to your account.`,
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
      state.payoutsReady[code] = false;
      bookCode = code;
      return { code, link: linkFor(code) };
    },

    async setUpPayouts() {
      requireRole(role, ['introducer']);
      checkArmed();
      // One passkey prompt's worth of wait, then a short confirmation. On
      // chain this is the register proof (~1s native) plus a transaction.
      await sleep(STAGE_DELAY_MS * 3);
      state.payoutsReady[bookCode] = true;
      persist();
      return { at: now() };
    },

    async getBook(): Promise<IntroducerBook> {
      requireRole(role, ['introducer']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const introducer =
        INTRODUCERS.find((i) => i.code === bookCode) ?? INTRODUCERS[0];
      const mine = state.subs.filter((s) => s.introducerCode === introducer.code);

      const entries: BookEntry[] = mine.map((s) => ({
        id: s.id,
        investorLabel: s.label,
        subscribed: s.subscribed,
        at: s.at,
        feeAccrued: feeOn(s.subscribed, rateFor(introducer.code)),
        vestsAt: vestsAtFor(s.at),
        vested: isVested(s.at),
        state: stateOf(s),
        feePaidAt: s.paidAt,
      }));

      const earning = mine.filter((s) => !s.recovered);
      const feeAccrued = accruedFor(introducer.code);
      const feeVested = vestedAccruedFor(introducer.code);
      const feeClaimed = settledFor(introducer.code);

      return {
        code: introducer.code,
        displayName: introducer.displayName,
        trailFeeBps: rateFor(introducer.code),
        vestingWindowDays: VESTING_WINDOW_DAYS,
        payoutsReady: state.payoutsReady[introducer.code] ?? false,
        entries,
        totals: {
          introducedCount: earning.length,
          subscribedTotal: addAmounts(...earning.map((s) => s.subscribed)),
          feeAccrued,
          feeClaimed,
          // vested minus settled, NOT accrued minus settled
          feeClaimable: subtractAmounts(feeVested, feeClaimed),
          feeVesting: subtractAmounts(feeAccrued, feeVested),
        },
      };
    },

    async claimFee(): Promise<ClaimReceipt> {
      requireRole(role, ['introducer']);
      checkArmed();

      const code = bookCode;
      const ready = earningFor(code).filter((s) => isVested(s.at) && !s.feeSettled);
      const claimable = sumFees(ready);

      if (toCents(claimable) <= 0) {
        // Distinguish "you have earned nothing" from "you have earned something
        // that has not vested" — they are different sentences on screen.
        const vesting = earningFor(code).filter((s) => !isVested(s.at));
        if (vesting.length > 0) {
          fail(
            'not-yet-vested',
            `Fee accrued but still inside its ${VESTING_WINDOW_DAYS}-day window`,
            { details: { vesting: sumFees(vesting), windowDays: String(VESTING_WINDOW_DAYS) } },
          );
        }
        fail('nothing-to-claim', 'No accrued fee available to claim');
      }

      // `claim` on the contract is a marking transaction, not a proof: the
      // scout signs once, the fund settles. One passkey's worth of wait.
      await sleep(STAGE_DELAY_MS * 2);
      const at = now();
      const ids = new Set(ready.map((s) => s.id));
      state.subs = state.subs.map((s) =>
        ids.has(s.id) ? { ...s, feeSettled: true, paidAt: at } : s,
      );
      persist();

      return { amount: claimable, txHash: hash(), at, provingMs: 0 };
    },

    // -- ledger ------------------------------------------------------------

    async getLedger(): Promise<AttributionLedger> {
      requireRole(role, ['issuer', 'auditor']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const rows: LedgerRow[] = state.subs.map((s) => {
        const introducer = INTRODUCERS.find((i) => i.code === s.introducerCode);
        return {
          id: s.id,
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
          recoverable: !s.recovered && !isVested(s.at) && !s.feeSettled,
          state: stateOf(s),
        };
      });

      const live = rows.filter((r) => r.state !== 'recovered');
      const subscribedTotal = addAmounts(...live.map((r) => r.subscribed));
      const feeAccruedTotal = addAmounts(...live.map((r) => r.feeAccrued));
      const feesSettledTotal = addAmounts(...live.filter((r) => r.feeSettled).map((r) => r.feeAccrued));

      return {
        fundName: FUND.name,
        rows,
        totals: {
          investorCount: live.length,
          introducerCount: new Set(live.map((r) => r.introducerCode)).size,
          subscribedTotal,
          unitsIssued: unitsFor(subscribedTotal),
          outstandingFeeLiability: subtractAmounts(feeAccruedTotal, feesSettledTotal),
          feesSettledTotal,
          feeVestingTotal: addAmounts(
            ...live.filter((r) => !isVested(r.at)).map((r) => r.feeAccrued),
          ),
        },
      };
    },

    async runSettlement(): Promise<SettlementReceipt> {
      requireRole(role, ['issuer']);
      checkArmed();

      const ready = state.subs.filter((s) => !s.recovered && !s.feeSettled && isVested(s.at));
      // Nothing to do is not an error for a payout run; it is a quiet receipt.
      const t = Date.now();
      await sleep(ready.length > 0 ? SETTLEMENT_PROVING_MS : STAGE_DELAY_MS);
      const provingMs = Date.now() - t;
      const at = now();
      const ids = new Set(ready.map((s) => s.id));
      state.subs = state.subs.map((s) =>
        ids.has(s.id) ? { ...s, feeSettled: true, paidAt: at } : s,
      );
      persist();
      return {
        settledCount: ready.length,
        introducerCount: new Set(ready.map((s) => s.introducerCode)).size,
        txHash: hash(),
        at,
        provingMs,
      };
    },

    async getAuditorAttestation(): Promise<AuditorAttestation> {
      requireRole(role, ['issuer', 'auditor']);
      checkArmed();
      await sleep(STAGE_DELAY_MS);

      const live = state.subs.filter((s) => !s.recovered);
      const outstanding = subtractAmounts(sumFees(live), sumFees(live.filter((s) => s.feeSettled)));

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
      if (hasWindow) {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
      persist();
    },
  };
}

/** Exported for the smoke test and for a dev panel, if you build one. */
export const stubTotals = ISSUER_TOTALS;
