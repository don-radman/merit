/**
 * Demo data — DESIGNED BY HAND, NOT GENERATED.
 * =========================================================================
 * The data is the story. Every figure here is chosen so the fee arithmetic is
 * legible on screen at a glance: the trail fee is 50 bps, so a $1,000,000
 * subscription earns exactly $5,000 and a judge can check it in their head.
 *
 * Rules if you change anything:
 *   - keep `feeAccrued` === subscribed x TRAIL_FEE_BPS / 10000, exactly
 *   - keep amounts HNW-plausible (six and seven figures, not 100)
 *   - keep names varied and boring-institutional; never "investor1"
 *   - keep the totals in `ISSUER_TOTALS` consistent (there is a check below)
 *
 * All names, funds and figures are FICTIONAL.
 */

import type { Amount, IntroducerCode, Timestamp } from './types.ts';

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

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * How long the stub pretends proof generation takes.
 *
 * REPLACE WITH THE MEASURED NUMBER once the spike lands — the real figure for
 * in-browser UltraHonk proving decides whether the fee claim is demoed live or
 * pre-warmed. Build the spinner against this; do not build against 0.
 */
export const PROVING_DELAY_MS = 2800;

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

export interface FixtureSubscription {
  /** Shown to the investor themselves, on their own statement. */
  fullName: string;
  /** Shown in the introducer book and the issuer ledger. */
  label: string;
  countryCode: string;
  introducerCode: IntroducerCode;
  subscribed: Amount;
  at: Timestamp;
  feeSettled: boolean;
}

export const SUBSCRIPTIONS: FixtureSubscription[] = [
  {
    fullName: 'Marguerite Oyelaran',
    label: 'M. Oyelaran · Singapore',
    countryCode: 'SG',
    introducerCode: 'CALDER-PR7',
    subscribed: '250000.00',
    at: '2026-10-19T04:12:00Z',
    feeSettled: true,
  },
  {
    fullName: 'Thomas Brandt-Nilsen',
    label: 'T. Brandt-Nilsen · Australia',
    countryCode: 'AU',
    introducerCode: 'CALDER-PR7',
    subscribed: '1000000.00',
    at: '2026-10-21T23:40:00Z',
    feeSettled: false,
  },
  {
    fullName: 'Yuki Harada',
    label: 'Y. Harada · Singapore',
    countryCode: 'SG',
    introducerCode: 'CALDER-PR7',
    subscribed: '400000.00',
    at: '2026-10-23T08:05:00Z',
    feeSettled: false,
  },
  {
    fullName: 'Alessandra Ruiz',
    label: 'A. Ruiz · Australia',
    countryCode: 'AU',
    introducerCode: 'CALDER-DO2',
    subscribed: '600000.00',
    at: '2026-10-24T02:55:00Z',
    feeSettled: false,
  },
];

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

/** The one piece of arithmetic in the demo a judge might check by hand. */
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
  return {
    investorCount: SUBSCRIPTIONS.length,
    introducerCount: INTRODUCERS.length,
    subscribedTotal,
    unitsIssued: unitsFor(subscribedTotal),
    feeAccruedTotal,
    feesSettledTotal,
    outstandingFeeLiability: subtractAmounts(feeAccruedTotal, feesSettledTotal),
  };
})();

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
    const accrued = addAmounts(
      ...SUBSCRIPTIONS.filter((s) => s.introducerCode === i.code).map((s) => feeOn(s.subscribed)),
    );
    if (toCents(i.feeClaimed) > toCents(accrued)) {
      throw new Error(`fixtures: ${i.code} has claimed more than it accrued`);
    }
  }
  if (toCents(ISSUER_TOTALS.outstandingFeeLiability) < 0) {
    throw new Error('fixtures: negative outstanding fee liability');
  }
})();
