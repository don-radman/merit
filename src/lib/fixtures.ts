/**
 * Demo data — DESIGNED BY HAND, NOT GENERATED.
 * =========================================================================
 * The data is the story. Every figure here is chosen so the fee arithmetic is
 * legible on screen at a glance: the trail fee is 50 bps, so a $1,000,000
 * subscription earns exactly $5,000 and a reader can check it in their head.
 *
 * Rules if you change anything:
 *   - keep `feeAccrued` === subscribed x TRAIL_FEE_BPS / 10000, exactly
 *   - keep amounts HNW-plausible (six and seven figures, not 100)
 *   - keep names varied and boring-institutional; never "investor1"
 *   - keep the totals in `ISSUER_TOTALS` consistent (there is a check below)
 *
 * All names, funds and figures are FICTIONAL.
 */

import type { Amount, IntroducerCode, Timestamp } from '@/lib/types.ts';

// ---------------------------------------------------------------------------
// The fund
// ---------------------------------------------------------------------------

/** CHANGE THIS if you pick a different name — it is in the video. */
export const FUND = {
  name: 'Calder Short-Duration Income Fund',
  unitCode: 'CSDIF',
  /** A money-market-style fund holds ~1.00, which keeps units readable. */
  unitPrice: '1.00' as Amount,
  minimumSubscription: '50000.00' as Amount,
  domicile: 'Singapore',
};

/** Trail fee the issuer pays the introducer, in basis points. 50 = 0.50%. */
export const TRAIL_FEE_BPS = 50;

/** Who holds the auditor view key in the demo. */
export const AUDITOR = 'Pellier & Co (appointed auditor)';

/**
 * How long a fee sits before the introducer can withdraw it. Inside the window
 * the issuer can recover it if the investor redeems early — the same mechanic
 * as insurance commission chargeback.
 *
 * 90 days reads well on screen and is plausible for a fund trail fee.
 */
export const VESTING_WINDOW_DAYS = 90;

const DAY_MS = 86_400_000;

/** An ISO timestamp N days before now, to the second. */
export function daysAgoIso(days: number): Timestamp {
  return new Date(Date.now() - days * DAY_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** When a fee subscribed at `at` becomes withdrawable. */
export function vestsAtFor(at: Timestamp): Timestamp {
  return new Date(Date.parse(at) + VESTING_WINDOW_DAYS * DAY_MS)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
}

export function isVested(at: Timestamp, now: number = Date.now()): boolean {
  return Date.parse(vestsAtFor(at)) <= now;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * How long the stub pretends proof generation takes.
 *
 * MEASURED, 25 Oct: a transfer-shaped UltraHonk proof took 6.5s in Node on an
 * M-series Mac, via stellar-confidential-token-sdk with OpenZeppelin's shipped
 * circuits. A register proof is much cheaper at 1.2-1.4s, and warm-up is
 * negligible, so pre-warming buys nothing — the cost is the circuit.
 *
 * In-browser is expected to be SLOWER than this (WASM, and single-threaded
 * without cross-origin isolation). Re-measure in the browser before recording
 * the demo video and update this again.
 */
export const PROVING_DELAY_MS = 6500;

/** Everything else in the stub is roughly this fast, per stage. */
export const STAGE_DELAY_MS = 450;

// ---------------------------------------------------------------------------
// Introducers
// ---------------------------------------------------------------------------

export interface FixtureIntroducer {
  code: IntroducerCode;
  displayName: string;
  /** Already claimed before the demo starts, so the book is not all-zero. */
  feeClaimed: Amount;
}

export const INTRODUCERS: FixtureIntroducer[] = [
  {
    code: 'CALDER-PR7',
    displayName: 'Raghunathan Family Office',
    feeClaimed: '2000.00',
  },
  {
    code: 'CALDER-DO2',
    displayName: 'Okonkwo Private Clients',
    feeClaimed: '0.00',
  },
];

/** The link an introducer shares. Change the host when the UI is deployed. */
export const LINK_BASE = 'https://introducer-rails.demo/i';

export function linkFor(code: IntroducerCode): string {
  return `${LINK_BASE}/${code}`;
}

// ---------------------------------------------------------------------------
// Subscriptions already on the books
// ---------------------------------------------------------------------------

interface FixtureSeed {
  fullName: string;
  label: string;
  countryCode: string;
  introducerCode: IntroducerCode;
  subscribed: Amount;
  /**
   * Days before *now*, not a fixed date. Two of these are past the 90-day
   * window and two are inside it, so the book screen always shows both a
   * claimable balance and a disabled, still-vesting one — the state that makes
   * the screen worth looking at, and the only way the claim button's disabled
   * case ever appears.
   */
  daysAgo: number;
  feeSettled: boolean;
}

export interface FixtureSubscription extends FixtureSeed {
  at: Timestamp;
  vestsAt: Timestamp;
  vested: boolean;
}

const SEEDS: FixtureSeed[] = [
  {
    fullName: 'Marguerite Oyelaran',
    label: 'M. Oyelaran \u00b7 Singapore',
    countryCode: 'SG',
    introducerCode: 'CALDER-PR7',
    subscribed: '250000.00',
    daysAgo: 166,
    feeSettled: true,
  },
  {
    fullName: 'Thomas Brandt-Nilsen',
    label: 'T. Brandt-Nilsen \u00b7 Australia',
    countryCode: 'AU',
    introducerCode: 'CALDER-PR7',
    subscribed: '1000000.00',
    daysAgo: 145,
    feeSettled: false,
  },
  {
    fullName: 'Yuki Harada',
    label: 'Y. Harada \u00b7 Singapore',
    countryCode: 'SG',
    introducerCode: 'CALDER-PR7',
    subscribed: '400000.00',
    daysAgo: 2,
    feeSettled: false,
  },
  {
    fullName: 'Alessandra Ruiz',
    label: 'A. Ruiz \u00b7 Australia',
    countryCode: 'AU',
    introducerCode: 'CALDER-DO2',
    subscribed: '600000.00',
    daysAgo: 1,
    feeSettled: false,
  },
];

export const SUBSCRIPTIONS: FixtureSubscription[] = SEEDS.map((seed) => {
  const at = daysAgoIso(seed.daysAgo);
  return { ...seed, at, vestsAt: vestsAtFor(at), vested: isVested(at) };
});

// ---------------------------------------------------------------------------
// Money helpers — integer cents internally, so no float ever touches a figure
// ---------------------------------------------------------------------------

/** "250000.00" -> 25000000 (cents). */
export function toCents(amount: Amount): number {
  const [whole, frac = '0'] = amount.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return Math.round(cents);
}

/** 25000000 -> "250000.00". */
export function fromCents(cents: number): Amount {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function addAmounts(...amounts: Amount[]): Amount {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0));
}

export function subtractAmounts(a: Amount, b: Amount): Amount {
  return fromCents(toCents(a) - toCents(b));
}

/** The one piece of arithmetic in the demo anyone might check by hand. */
export function feeOn(subscribed: Amount, bps: number = TRAIL_FEE_BPS): Amount {
  return fromCents(Math.round((toCents(subscribed) * bps) / 10000));
}

/** units = subscribed / unitPrice. Unit price is 1.00, so this stays exact. */
export function unitsFor(subscribed: Amount, unitPrice: Amount = FUND.unitPrice): Amount {
  const priceCents = toCents(unitPrice);
  if (priceCents === 0) return '0.00';
  return fromCents(Math.round((toCents(subscribed) * 100) / priceCents));
}

// ---------------------------------------------------------------------------
// Derived totals, computed from the fixtures above so they cannot drift
// ---------------------------------------------------------------------------

export const ISSUER_TOTALS = (() => {
  const subscribedTotal = addAmounts(...SUBSCRIPTIONS.map((s) => s.subscribed));
  const feeAccruedTotal = addAmounts(...SUBSCRIPTIONS.map((s) => feeOn(s.subscribed)));
  const feesSettledTotal = addAmounts(...INTRODUCERS.map((i) => i.feeClaimed));
  const feeVestingTotal = addAmounts(
    ...SUBSCRIPTIONS.filter((s) => !s.vested).map((s) => feeOn(s.subscribed)),
  );
  return {
    investorCount: SUBSCRIPTIONS.length,
    introducerCount: INTRODUCERS.length,
    subscribedTotal,
    unitsIssued: unitsFor(subscribedTotal),
    feeAccruedTotal,
    feesSettledTotal,
    outstandingFeeLiability: subtractAmounts(feeAccruedTotal, feesSettledTotal),
    /** Of the outstanding liability, still inside its window. */
    feeVestingTotal,
  };
})();

/** Fee accrued for one introducer, counting only entries past their window. */
export function vestedFor(code: IntroducerCode): Amount {
  return addAmounts(
    ...SUBSCRIPTIONS.filter((s) => s.introducerCode === code && s.vested).map((s) =>
      feeOn(s.subscribed),
    ),
  );
}

/**
 * Sanity check, run at import. If someone edits a figure and forgets the
 * arithmetic, this throws at startup rather than putting a wrong number on
 * screen during the demo.
 */
(function assertFixturesConsistent() {
  for (const s of SUBSCRIPTIONS) {
    if (!INTRODUCERS.some((i) => i.code === s.introducerCode)) {
      throw new Error(`fixtures: subscription for unknown introducer ${s.introducerCode}`);
    }
  }
  for (const i of INTRODUCERS) {
    // Claimed must not exceed VESTED, not merely accrued — an introducer
    // cannot have withdrawn a fee that was still inside its window.
    const vested = vestedFor(i.code);
    if (toCents(i.feeClaimed) > toCents(vested)) {
      throw new Error(
        `fixtures: ${i.code} has claimed ${i.feeClaimed} but only ${vested} has vested`,
      );
    }
  }
  if (!SUBSCRIPTIONS.some((s) => s.vested) || !SUBSCRIPTIONS.some((s) => !s.vested)) {
    throw new Error(
      'fixtures: the demo needs BOTH a vested and an unvested entry — ' +
        'otherwise the claim button never shows its disabled state',
    );
  }
  if (toCents(ISSUER_TOTALS.outstandingFeeLiability) < 0) {
    throw new Error('fixtures: negative outstanding fee liability');
  }
})();
