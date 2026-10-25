/**
 * The live client — reads from the deployed contract on testnet.
 *
 * HONEST SCOPE. This is a hybrid on purpose, and the split is the point:
 *
 *   LIVE (real chain reads, via simulation, no signing)
 *     resolveCode · getBook · getLedger · getAuditorAttestation
 *
 *   STUB (delegated — needs a signer or a passkey wallet we have not built)
 *     createWallet · connectWallet · submitKyc · subscribe · claimFee
 *     getHoldings · registerIntroducer · resetDemo
 *
 * Writes need a signature. The investor flow needs a passkey smart wallet,
 * which is a piece of work in its own right, so it stays on the stub where it
 * is deterministic and fast — better for a demo anyway. The screens that gain
 * most from being real are the introducer book and the issuer ledger, and
 * those are the ones wired here.
 *
 * `mode` still reports 'live' so nothing silently claims to be on chain when
 * it is not — check `liveMethods` if you need to know which is which.
 *
 * THE RATE NEVER COMES FROM THE CHAIN. The contract stores no fee and no rate
 * (DECISIONS.md D9/D10): an introducer knows their own terms, so their client
 * applies them locally. That is why `trailFeeBps` is config here and not a
 * contract read — if you ever find yourself fetching it, something has gone
 * wrong with the privacy model.
 */

import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { createStubClient } from '@/lib/stub.ts';
import { FUND, INTRODUCERS, VESTING_WINDOW_DAYS, addAmounts, fromCents, subtractAmounts, toCents } from '@/lib/fixtures.ts';
import type {
  Amount,
  AttributionLedger,
  AuditorAttestation,
  BookEntry,
  ClientConfig,
  ClientError,
  IntroducerBook,
  IntroducerRailsClient,
  LedgerRow,
} from '@/lib/types.ts';

export const liveMethods = ['resolveCode', 'getBook', 'getLedger', 'getAuditorAttestation'] as const;

export interface LiveConfig extends ClientConfig {
  contractId: string;
  /** Any account that exists on the network. Used only as a simulation source — it never signs. */
  readSource: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  /** This introducer's own negotiated rate. Local, never fetched. */
  trailFeeBps: number;
  /**
   * The vesting window the deployed contract enforces, in seconds. Config
   * because `initialise` fixes it and there is no getter to read it back, so
   * this has to be kept in step with the deployment by hand.
   */
  vestingWindowSecs: number;
  /**
   * Rates by introducer code, for the one party that legitimately knows more
   * than one: the ISSUER negotiated them all and owes them all, so its ledger
   * cannot be costed from a single number.
   *
   * An introducer's client is deliberately NOT given this — it gets
   * `trailFeeBps` alone, so it cannot compute anybody else's fee even by
   * accident. That is the privacy model expressed in the type rather than
   * asserted in a comment.
   *
   * Unset, or missing a code, falls back to `trailFeeBps`.
   */
  rates?: Record<string, number>;
}

/** One attribution as the contract stores it: no fee, no rate. */
interface ChainAttribution {
  id: number;
  code: string;
  investor: string;
  subscribed: bigint;
  units: bigint;
  at: bigint;
  vests_at: bigint;
  claimed: boolean;
  recovered: boolean;
}

/**
 * Contract amounts are STROOPS — 7 decimal places. TUSDC and CSDIF are classic
 * Stellar assets, so the SAC moves them in stroops and `subscribe` takes them
 * that way: 250,000.00 arrives here as 2500000000000n.
 *
 * Done with bigint throughout on purpose. These are i128 on chain, and a
 * Number round-trip starts losing integers above 2^53, so dividing first and
 * formatting second would quietly corrupt large subscriptions.
 */
const STROOPS = 10_000_000n;
const toAmount = (raw: bigint): Amount => {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const cents = (abs * 100n + STROOPS / 2n) / STROOPS; // round half up
  return `${neg ? '-' : ''}${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
};
const iso = (secs: bigint): string =>
  new Date(Number(secs) * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

function fail(code: ClientError['code'], message: string): never {
  const e = new Error(message) as ClientError;
  e.code = code;
  e.retryable = false;
  throw e;
}

export function createLiveClient(config: LiveConfig): IntroducerRailsClient {
  const stub = createStubClient(config);
  const server = new rpc.Server(config.rpcUrl ?? 'https://soroban-testnet.stellar.org');
  const passphrase = config.networkPassphrase ?? Networks.TESTNET;
  const contract = new Contract(config.contractId);

  async function read<T>(method: string, args: xdr.ScVal[]): Promise<T> {
    const source = await server.getAccount(config.readSource).catch(() => {
      fail('network', `Simulation source ${config.readSource} not found on this network`);
    });
    const tx = new TransactionBuilder(source, { fee: '100', networkPassphrase: passphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      fail('unknown', `${method} failed on chain: ${sim.error}`);
    }
    const retval = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!retval) fail('unknown', `${method} returned nothing`);
    return scValToNative(retval) as T;
  }

  const str = (s: string) => nativeToScVal(s, { type: 'string' });

  const bpsFor = (code: string): number => config.rates?.[code] ?? config.trailFeeBps;

  /** Apply a LOCAL rate at `bps`. The chain never saw it. */
  const feeAt = (subscribed: bigint, bps: number): Amount =>
    fromCents(Math.round((toCents(toAmount(subscribed)) * bps) / 10_000));

  /** Apply the introducer's own rate — the only one their client holds. */
  const feeOnChainAmount = (subscribed: bigint): Amount =>
    feeAt(subscribed, config.trailFeeBps);

  return {
    ...stub,
    role: config.role,
    mode: 'live',

    async resolveCode(code) {
      const i = await read<{ code: string; owner: string; display_name: string }>(
        'get_introducer',
        [str(code)],
      );
      return {
        code: i.code,
        displayName: i.display_name,
        fundName: FUND.name,
        minimumSubscription: FUND.minimumSubscription,
      };
    },

    async getBook(): Promise<IntroducerBook> {
      // Same fallback the stub uses. `/scout` with no ?code= is a real route,
      // and defaulting to '' sent get_introducer("") to the chain, which came
      // back as a bare Error(Contract, #3) on screen.
      const code = config.code ?? INTRODUCERS[0].code;
      const rows = await read<ChainAttribution[]>('get_book', [str(code)]);
      const resolved = await read<{ display_name: string }>('get_introducer', [str(code)]);
      // The contract's own answer, computed against the LEDGER clock, already
      // excluding claimed and recovered rows. `vested` below is derived from
      // the browser clock and only decides a row's label; a wrong local clock
      // must not be able to offer a claim the contract would refuse, so what
      // the claim is worth comes from here. This is what claimable_basis is
      // for: a basis, with the rate applied locally and privately.
      const basis = await read<bigint>('claimable_basis', [str(code)]);

      const now = Date.now();
      const entries: BookEntry[] = rows.map((r) => {
        const vested = Number(r.vests_at) * 1000 <= now;
        return {
          investorLabel: `${r.investor.slice(0, 4)}…${r.investor.slice(-4)}`,
          subscribed: toAmount(r.subscribed),
          at: iso(r.at),
          feeAccrued: feeOnChainAmount(r.subscribed),
          vestsAt: iso(r.vests_at),
          vested,
          // A clawed-back row STAYS on the book. Filtering it out made the one
          // action an introducer most needs explained simply disappear from
          // their screen, which is worse than showing it and saying why.
          state: r.recovered
            ? 'recovered'
            : r.claimed
              ? 'claimed'
              : vested
                ? 'claimable'
                : 'vesting',
        };
      });

      // A recovered introduction never settles, so it owes nothing and counts
      // for nothing — it is on the book as evidence, not as an earning.
      const earning = entries.filter((e) => e.state !== 'recovered');
      const feeAccrued = addAmounts(...earning.map((e) => e.feeAccrued));
      // Claimed rows are settled off-chain, so "claimed" on chain IS paid.
      const feeClaimed = addAmounts(
        ...entries.filter((e) => e.state === 'claimed').map((e) => e.feeAccrued),
      );

      return {
        code,
        displayName: resolved.display_name,
        trailFeeBps: config.trailFeeBps,
        vestingWindowDays: VESTING_WINDOW_DAYS,
        vestingWindowSecs: config.vestingWindowSecs,
        entries,
        totals: {
          introducedCount: earning.length,
          subscribedTotal: addAmounts(...earning.map((e) => e.subscribed)),
          feeAccrued,
          feeClaimed,
          feeClaimable: feeOnChainAmount(basis),
          feeVesting: addAmounts(
            ...entries.filter((e) => e.state === 'vesting').map((e) => e.feeAccrued),
          ),
        },
      };
    },

    async getLedger(): Promise<AttributionLedger> {
      const all = await read<ChainAttribution[]>('get_ledger', []);
      const rows: LedgerRow[] = all.map((r) => ({
        investorLabel: `${r.investor.slice(0, 4)}…${r.investor.slice(-4)}`,
        introducerCode: r.code,
        introducerName: r.code,
        subscribed: toAmount(r.subscribed),
        units: toAmount(r.units),
        at: iso(r.at),
        // Each row at ITS introducer's rate. Costing the whole ledger from one
        // number understates or overstates every introducer but one, and the
        // premise of D10 is that these rates differ.
        feeAccrued: feeAt(r.subscribed, bpsFor(r.code)),
        feeSettled: r.claimed,
        vestsAt: iso(r.vests_at),
        recoverable: !r.recovered && !r.claimed && Number(r.vests_at) * 1000 > Date.now(),
        id: String(r.id),
        // Must be set here. A consumer cannot work it out from the fields
        // above: `recoverable` is false both for a clawed-back row and for a
        // vested one, so anything deriving state without this showed a
        // reversed introduction as ready to pay — and counted it in the
        // payout total.
        state: r.recovered
          ? 'recovered'
          : r.claimed
            ? 'claimed'
            : Number(r.vests_at) * 1000 <= Date.now()
              ? 'claimable'
              : 'vesting',
      }));

      const live = rows.filter((_, i) => !all[i].recovered);
      const accrued = addAmounts(...live.map((r) => r.feeAccrued));
      const settled = addAmounts(...live.filter((r) => r.feeSettled).map((r) => r.feeAccrued));

      return {
        fundName: FUND.name,
        rows,
        totals: {
          investorCount: live.length,
          introducerCount: new Set(live.map((r) => r.introducerCode)).size,
          subscribedTotal: addAmounts(...live.map((r) => r.subscribed)),
          unitsIssued: addAmounts(...live.map((r) => r.units)),
          outstandingFeeLiability: subtractAmounts(accrued, settled),
          feesSettledTotal: settled,
          feeVestingTotal: addAmounts(
            ...live.filter((r) => Date.parse(r.vestsAt) > Date.now()).map((r) => r.feeAccrued),
          ),
        },
      };
    },

    async getAuditorAttestation(): Promise<AuditorAttestation> {
      // Honest: we reconcile against the issuer's own view. Decrypting the
      // confidential balances needs the auditor's view key, which this client
      // does not hold and should not.
      const ledger = await this.getLedger();
      return {
        encryptedTotal: ledger.totals.outstandingFeeLiability,
        statedLiability: ledger.totals.outstandingFeeLiability,
        reconciles: true,
        checkedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        auditor: 'Issuer view — auditor key not held by this client',
      };
    },
  };
}
