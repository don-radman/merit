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
import { hrefFor } from '@/route.ts';

// ---------------------------------------------------------------------------
// The fund
// ---------------------------------------------------------------------------

/** CHANGE THIS if you pick a different name — it is in the video. */
export const FUND = {
  // Non-breaking hyphen (U+2011): the name wraps as "Calder Short‑Duration /
  // Income Fund" on a phone instead of breaking after "Short-".
  name: 'Calder Short‑Duration Income Fund',
  unitCode: 'CSDIF',
  /** A money-market-style fund holds ~1.00, which keeps units readable. */
  unitPrice: '1.00' as Amount,
  minimumSubscription: '50000.00' as Amount,
  domicile: 'Singapore',
};

/**
 * The product, as distinct from the fund. The fund is what the INVESTOR sees
 * (they are buying Calder units through someone they trust); the product is
 * what the SCOUT and the ISSUER see. Working name — change it here and it
 * changes everywhere.
 */
export const PRODUCT = {
  // "Merit": value earned through action; "on the merits" in legal and
  // financial use; warm in everyday speech. "Introduced via Merit."
  name: 'Merit',
  tagline: 'Credit where it’s due.',
  /**
   * What we call an introducer on screen. One word, no jargon. "Adviser"
   * because that is what the Calder portal (site/) says, and the video cuts
   * between the two surfaces — one word for one role.
   */
  roleLabel: 'Adviser',
};

/**
 * The DEFAULT trail fee, in basis points. 50 = 0.50%.
 *
 * Rates are negotiated per introducer and differ — that is the whole point of
 * keeping them off the chain, and a demo where every introducer has the same
 * rate quietly refutes its own privacy claim. Each fixture introducer carries
 * its own.
 */
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
  /** This introducer's own negotiated rate. Never on chain. */
  trailFeeBps: number;
  /** Already claimed before the demo starts, so the book is not all-zero. */
  feeClaimed: Amount;
}

export const INTRODUCERS: FixtureIntroducer[] = [
  {
    code: 'CALDER-PR7',
    displayName: 'Raghunathan Family Office',
    trailFeeBps: 50,
    // = the one settled row below: 250,000 at 50 bps.
    feeClaimed: '1250.00',
  },
  {
    code: 'CALDER-DO2',
    // Matches scripts/seed-demo.sh so stub and live show the same names.
    displayName: 'Dorsey Oakes Partners',
    trailFeeBps: 70,
    feeClaimed: '0.00',
  },
];

/** The link an introducer shares, when there is no browser to ask. */
export const LINK_BASE = 'https://introducer-rails.demo/i';

/**
 * In a browser the link points at THIS deployment (path or hash routing, see
 * route.ts), so the demo is one tab:
 * copy the link on the scout screen, open it, and the investor flow runs
 * against the same in-memory stub. Outside a browser (smoke test) it falls
 * back to the placeholder host.
 */
export function linkFor(code: IntroducerCode): string {
  if (typeof location === 'undefined' || !location.origin) return `${LINK_BASE}/${code}`;
  return hrefFor(`/i/${code}`);
}

/**
 * How long the stub pretends the ISSUER's settlement proof takes. The issuer
 * proves natively (bb, not WASM) — SPIKE.md measured register at 0.11s native
 * against 1.2s in Node — so a payout run is a short beat, not a long one.
 * Includes a notional transaction confirmation.
 */
export const SETTLEMENT_PROVING_MS = 1400;

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
  /**
   * The investor redeemed inside the window and the issuer recovered the
   * introduction. It stays on the book as evidence — the one action a scout
   * most wants explained — but earns nothing and counts for nothing.
   */
  recovered?: boolean;
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
    // The reversed one. Mirrors seed-demo.sh's clawed-back row (180,000 on
    // PR7) so the stub shows the same fourth state the chain does.
    fullName: 'Henrik Solberg',
    label: 'H. Solberg \u00b7 Singapore',
    countryCode: 'SG',
    introducerCode: 'CALDER-PR7',
    subscribed: '180000.00',
    daysAgo: 31,
    feeSettled: false,
    recovered: true,
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

/** Rows that earn: everything not clawed back. Recovered rows are evidence only. */
export const EARNING = SUBSCRIPTIONS.filter((s) => !s.recovered);

export const ISSUER_TOTALS = (() => {
  const subscribedTotal = addAmounts(...EARNING.map((s) => s.subscribed));
  const feeAccruedTotal = addAmounts(
    ...EARNING.map((s) => feeOn(s.subscribed, rateFor(s.introducerCode))),
  );
  // Settled is a property of a ROW now, not a running total per introducer,
  // so the book can say which introduction was the one that paid.
  const feesSettledTotal = addAmounts(
    ...EARNING.filter((s) => s.feeSettled).map((s) => feeOn(s.subscribed, rateFor(s.introducerCode))),
  );
  const feeVestingTotal = addAmounts(
    ...EARNING.filter((s) => !s.vested).map((s) =>
      feeOn(s.subscribed, rateFor(s.introducerCode)),
    ),
  );
  return {
    investorCount: EARNING.length,
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

/** An introducer's own rate. Falls back to the default for unknown codes. */
export function rateFor(code: IntroducerCode): number {
  const found = INTRODUCERS.find((i) => i.code === code);
  return found ? found.trailFeeBps : TRAIL_FEE_BPS;
}

/** Fee accrued for one introducer, counting only entries past their window. */
export function vestedFor(code: IntroducerCode): Amount {
  return addAmounts(
    ...EARNING.filter((s) => s.introducerCode === code && s.vested).map((s) =>
      feeOn(s.subscribed, rateFor(code)),
    ),
  );
}

/** Fee already settled for one introducer — the sum of its paid rows. */
export function settledFor(code: IntroducerCode): Amount {
  return addAmounts(
    ...EARNING.filter((s) => s.introducerCode === code && s.feeSettled).map((s) =>
      feeOn(s.subscribed, rateFor(code)),
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
    // And it must agree with the rows: a paid row is where a claimed figure
    // comes from, so the two cannot be edited independently.
    const settled = settledFor(i.code);
    if (toCents(i.feeClaimed) !== toCents(settled)) {
      throw new Error(
        `fixtures: ${i.code} says feeClaimed ${i.feeClaimed} but its settled rows sum to ${settled}`,
      );
    }
    // A settled row must have vested first.
    for (const s of SUBSCRIPTIONS) {
      if (s.introducerCode === i.code && s.feeSettled && !s.vested) {
        throw new Error(`fixtures: ${s.label} is settled but has not vested`);
      }
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
