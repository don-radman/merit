/**
 * Introducer Rails — FROZEN CLIENT INTERFACE
 * =========================================================================
 * This file is the contract between the contracts developer and the UI.
 *
 * FROZEN at hour 0. Do not change a signature here without telling the other
 * person out loud — every screen is built against these types, and the stub in
 * `stub.ts` and the live client in `live.ts` must both satisfy them.
 *
 * Adding a new optional field is fine. Renaming, removing or changing the type
 * of anything already here is not.
 *
 * The UI imports ONLY from this module and `index.ts`. It never imports the
 * Stellar SDK, never builds a transaction, never sees a keypair, and never
 * touches a ciphertext. See DECISIONS.md D5.
 */

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

/**
 * A decimal amount as a display-safe string, e.g. "250000.00" or "1250.00".
 * ALWAYS a string, NEVER a JS number — these are money and some of them are
 * seven figures. The client layer converts to and from stroops internally.
 * Render it directly; format with `formatAmount()` if you want grouping.
 */
export type Amount = string;

/** A Stellar address: `G...` for an account, `C...` for a contract. */
export type Address = string;

/** A short, URL-safe introducer code, e.g. "CALDER-PR7". Case-insensitive. */
export type IntroducerCode = string;

/** A transaction hash, for linking out to an explorer. */
export type TxHash = string;

/** ISO 8601 timestamp, e.g. "2026-10-25T14:32:05Z". */
export type Timestamp = string;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Who the client is acting as. This is not cosmetic — it decides what the
 * client can decrypt. An `introducer` client can read its own fee balance and
 * nobody else's. An `issuer` client reads the full attribution ledger. An
 * `auditor` client reads encrypted totals only, never an individual position.
 *
 * One client per screen:
 *   investor screen   -> createClient({ role: 'investor' })
 *   introducer book   -> createClient({ role: 'introducer', code })
 *   issuer ledger     -> createClient({ role: 'issuer' })
 */
export type Role = 'investor' | 'introducer' | 'issuer' | 'auditor';

export interface ClientConfig {
  role: Role;
  /** Required for `introducer`: which book to open. */
  code?: IntroducerCode;
  /** Optional: an already-connected wallet address, to skip onboarding. */
  address?: Address;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Every rejected promise from this client is a `ClientError`. Switch on `code`
 * to pick the message — do not parse `message`, it is for humans and logs.
 *
 * EVERY ONE OF THESE NEEDS A UI STATE. The happy path is about a third of the
 * work on the investor screen.
 */
export type ClientErrorCode =
  /** The browser or the user declined the passkey prompt. Offer a retry. */
  | 'passkey-declined'
  /** Passkeys unavailable here (no platform authenticator, insecure origin). */
  | 'passkey-unsupported'
  /** Mock KYC rejected. Demo-only; show the reason and allow a retry. */
  | 'kyc-failed'
  /** Introducer code does not exist. Likely a mistyped or stale link. */
  | 'unknown-code'
  /** The issuer has not authorized this investor's trustline yet. */
  | 'trustline-not-authorized'
  /** Investor does not hold enough testnet USDC. Offer the faucet. */
  | 'insufficient-usdc'
  /** Below the fund's minimum subscription. `details.minimum` has the figure. */
  | 'below-minimum'
  /** Proof generation or verification failed. The one to watch — see D6. */
  | 'proof-failed'
  /** Nothing available to claim right now. */
  | 'nothing-to-claim'
  /** Fee has accrued but is still inside its vesting window. */
  | 'not-yet-vested'
  /** RPC unreachable, timed out, or the transaction never confirmed. */
  | 'network'
  | 'unknown';

export interface ClientError extends Error {
  code: ClientErrorCode;
  /** Set when the failure is worth retrying unchanged. */
  retryable: boolean;
  /** Extra context, e.g. `{ minimum: "50000.00" }`. */
  details?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export interface Wallet {
  address: Address;
  /** What to show in the corner of the screen, e.g. "Passkey · ...X4F2". */
  label: string;
  /** True when this wallet was created in this session, not reconnected. */
  isNew: boolean;
}

export interface KycInput {
  fullName: string;
  /** ISO 3166-1 alpha-2, e.g. "SG", "AU". */
  countryCode: string;
  /** Declared investor category. Mock — not verified against anything. */
  category: 'individual' | 'family-office' | 'institution';
}

export interface KycResult {
  status: 'passed' | 'failed';
  /** Present when failed. Safe to show the investor. */
  reason?: string;
  /** Opaque reference to quote back in the statement. */
  reference: string;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/**
 * The six stages of the demo flow, in order. The investor screen shows these
 * as visible progress — `authorizing-trustline` and `generating-proof` are
 * both REAL WAITS of a second or more, so they need spinners and ideally
 * copy that says what is happening.
 */
export type SubscriptionStage =
  | 'awaiting-signature'
  | 'authorizing-trustline'
  | 'transferring-usdc'
  | 'minting-units'
  | 'generating-proof'
  | 'accruing-fee'
  | 'done';

export interface SubscribeInput {
  code: IntroducerCode;
  usdcAmount: Amount;
  /**
   * Called on every stage transition. Drive the progress UI from this.
   * Fires with 'done' exactly once, immediately before the promise resolves.
   */
  onStage?: (stage: SubscriptionStage) => void;
}

export interface SubscriptionReceipt {
  /** Units of the fund issued to the investor. */
  units: Amount;
  /** USDC actually taken. */
  subscribed: Amount;
  /** Net asset value per unit used for this subscription. */
  unitPrice: Amount;
  /** Attributed introducer, for the confirmation screen. */
  introducer: { code: IntroducerCode; displayName: string };
  txHash: TxHash;
  at: Timestamp;
  /**
   * How long proof generation actually took, in ms. Log it — this number
   * decides whether the fee claim is demoed live or pre-warmed in the video.
   */
  provingMs: number;
}

// ---------------------------------------------------------------------------
// Investor: holdings statement (screen 1, after subscribing)
// ---------------------------------------------------------------------------

export interface HoldingsStatement {
  fundName: string;
  /** Asset code of the fund unit, e.g. "CSDIF". */
  unitCode: string;
  units: Amount;
  unitPrice: Amount;
  /** units x unitPrice, precomputed so the UI never does money arithmetic. */
  valueUsd: Amount;
  subscribedTotal: Amount;
  firstSubscribedAt: Timestamp;
  /** Issuer controls in force on this asset, for the disclosure line. */
  issuerControls: {
    trustlineAuthorized: boolean;
    freezeEnabled: boolean;
    clawbackEnabled: boolean;
  };
  /**
   * Plain-English statement lines, already ordered. Render as-is or rewrite —
   * the copy is a UI concern, but shipping the structure means the screen is
   * never blank while someone decides on wording.
   */
  summary: string[];
}

// ---------------------------------------------------------------------------
// Introducer: my book (screen 2)
// ---------------------------------------------------------------------------

export interface BookEntry {
  /** A label, not a legal name — "Investor 3 · Singapore". */
  investorLabel: string;
  subscribed: Amount;
  at: Timestamp;
  /**
   * Trail fee accrued on this entry. CONFIDENTIAL: decrypted client-side for
   * this introducer only. Do not log it, do not put it in a URL.
   *
   * Accrued is not the same as withdrawable — see `vested`.
   */
  feeAccrued: Amount;
  /** When this entry's fee becomes withdrawable. */
  vestsAt: Timestamp;
  /**
   * Whether it has. Read this rather than comparing `vestsAt` to the browser's
   * clock: vesting is settled on-chain, and a wrong local clock must not be
   * able to enable a claim button the contract will reject.
   */
  vested: boolean;
}

export interface IntroducerBook {
  code: IntroducerCode;
  displayName: string;
  /** Share the issuer pays this introducer, in basis points. 50 = 0.50%. */
  trailFeeBps: number;
  /**
   * How long a fee sits before it can be withdrawn. The issuer can recover it
   * during this window if the investor redeems early — the same mechanic as
   * insurance commission chargeback.
   */
  vestingWindowDays: number;
  entries: BookEntry[];
  totals: {
    introducedCount: number;
    subscribedTotal: Amount;
    /** CONFIDENTIAL. Everything earned, vested or not. */
    feeAccrued: Amount;
    /** CONFIDENTIAL. Already withdrawn. */
    feeClaimed: Amount;
    /**
     * CONFIDENTIAL. What the claim button would pay out right now:
     * **vested minus claimed**, NOT accrued minus claimed.
     *
     * This definition changed when vesting was added. If you are reading old
     * code that treats it as accrued − claimed, that code is wrong.
     */
    feeClaimable: Amount;
    /** CONFIDENTIAL. Accrued, not yet vested — earned but not withdrawable. */
    feeVesting: Amount;
  };
}

export interface ClaimReceipt {
  amount: Amount;
  txHash: TxHash;
  at: Timestamp;
  provingMs: number;
}

// ---------------------------------------------------------------------------
// Issuer: attribution ledger (screen 3)
// ---------------------------------------------------------------------------

export interface LedgerRow {
  investorLabel: string;
  introducerCode: IntroducerCode;
  introducerName: string;
  subscribed: Amount;
  units: Amount;
  at: Timestamp;
  /** Visible to the issuer: it is the issuer's own liability. */
  feeAccrued: Amount;
  feeSettled: boolean;
  /** When the introducer can withdraw this fee. */
  vestsAt: Timestamp;
  /**
   * Whether the issuer could still recover this fee — accrued, unvested and
   * unclaimed. The issuer's side of the vesting window.
   */
  recoverable: boolean;
}

export interface AttributionLedger {
  fundName: string;
  rows: LedgerRow[];
  totals: {
    investorCount: number;
    introducerCount: number;
    subscribedTotal: Amount;
    unitsIssued: Amount;
    /** Accrued and not yet claimed — the number a CFO cares about. */
    outstandingFeeLiability: Amount;
    feesSettledTotal: Amount;
    /** Of the outstanding liability, how much is still inside its window. */
    feeVestingTotal: Amount;
  };
}

/**
 * The reconciliation beat: an auditor holding a view key can confirm the
 * encrypted fee balances sum to the issuer's stated liability, without any
 * individual introducer's position being public. Cheap to render, strong on
 * the "Unlocked" track — put it at the bottom of the issuer screen.
 */
export interface AuditorAttestation {
  /** Sum of all encrypted fee balances, as decrypted by the auditor key. */
  encryptedTotal: Amount;
  /** What the issuer's public ledger claims it owes. */
  statedLiability: Amount;
  reconciles: boolean;
  checkedAt: Timestamp;
  /** The auditor identity doing the attesting. */
  auditor: string;
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

/**
 * One interface, role-scoped at construction. Calling a method your role is
 * not allowed to call rejects with `code: 'unknown'` rather than returning
 * someone else's data.
 */
export interface IntroducerRailsClient {
  readonly role: Role;
  /** 'stub' or 'live'. Show it somewhere in dev so nobody demos the stub. */
  readonly mode: 'stub' | 'live';

  // -- onboarding (investor) ------------------------------------------------
  /** Create a passkey smart wallet. Rejects 'passkey-declined' if dismissed. */
  createWallet(label?: string): Promise<Wallet>;
  /** Reconnect an existing passkey wallet. */
  connectWallet(): Promise<Wallet>;
  /** Mock KYC. Always passes in stub mode unless a failure is armed. */
  submitKyc(input: KycInput): Promise<KycResult>;

  // -- the introducer link (investor) --------------------------------------
  /**
   * Resolve a code from the URL before showing the subscribe form, so an
   * unknown code is an error state and not a failed subscription.
   */
  resolveCode(code: IntroducerCode): Promise<{
    code: IntroducerCode;
    displayName: string;
    fundName: string;
    minimumSubscription: Amount;
  }>;

  // -- subscribe (investor) ------------------------------------------------
  subscribe(input: SubscribeInput): Promise<SubscriptionReceipt>;
  getHoldings(address?: Address): Promise<HoldingsStatement>;

  // -- book (introducer) ---------------------------------------------------
  /** Register a new introducer. Returns the code and the shareable link. */
  registerIntroducer(input: { displayName: string }): Promise<{
    code: IntroducerCode;
    link: string;
  }>;
  getBook(): Promise<IntroducerBook>;
  claimFee(): Promise<ClaimReceipt>;

  // -- ledger (issuer / auditor) -------------------------------------------
  getLedger(): Promise<AttributionLedger>;
  getAuditorAttestation(): Promise<AuditorAttestation>;

  // -- demo plumbing -------------------------------------------------------
  /**
   * Reset to seeded fixture state. Bound to a key in dev — between video
   * takes you will use this more than anything else in this file.
   */
  resetDemo(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Formatting helper
// ---------------------------------------------------------------------------

/**
 * Group an Amount for display: "2750000.00" -> "2,750,000.00".
 *
 * `Intl.NumberFormat` accepts a STRING, so the value goes straight through
 * without a `Number()` round-trip. That matters: formatting the string
 * "9007199254740993.99" is exact, while the same value via `Number()` comes
 * back as "...994.00". Our figures are far below that, but the entire point of
 * `Amount` being a string is that no float ever touches money, and a formatter
 * that quietly converted would be the one place it did.
 *
 * The locale is pinned on purpose. Unpinned, this renders "2.750.000,00" on a
 * machine set to a European locale, which would silently change what the demo
 * video shows.
 */
const GROUPED = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * `Intl.NumberFormat.prototype.format` accepts a decimal string at runtime,
 * which is what keeps these formatters off floats. TypeScript 7's lib still
 * types the parameter as `number | bigint`, so this cast is the type system
 * catching up — nothing converts the value. Keep it in this one place.
 */
function format(f: Intl.NumberFormat, amount: Amount): string {
  return f.format(amount as unknown as number);
}

export function formatAmount(amount: Amount): string {
  return format(GROUPED, amount);
}

/** Same, with the currency: "250000.00" -> "$250,000.00". */
const USD = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(amount: Amount): string {
  return format(USD, amount);
}
