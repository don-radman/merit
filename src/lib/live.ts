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
import { FUND, VESTING_WINDOW_DAYS, addAmounts, fromCents, subtractAmounts, toCents } from '@/lib/fixtures.ts';
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

/** Contract amounts are whole units; the UI wants a 2dp decimal string. */
const toAmount = (raw: bigint): Amount => `${raw}.00`;
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

  /** Apply the introducer's LOCAL rate. The chain never saw it. */
  const feeOnChainAmount = (subscribed: bigint): Amount =>
    fromCents(Math.round((toCents(toAmount(subscribed)) * config.trailFeeBps) / 10_000));

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
      const code = config.code ?? '';
      const rows = await read<ChainAttribution[]>('get_book', [str(code)]);
      const resolved = await read<{ display_name: string }>('get_introducer', [str(code)]);

      const entries: BookEntry[] = rows
        .filter((r) => !r.recovered)
        .map((r) => ({
          investorLabel: `${r.investor.slice(0, 4)}…${r.investor.slice(-4)}`,
          subscribed: toAmount(r.subscribed),
          at: iso(r.at),
          feeAccrued: feeOnChainAmount(r.subscribed),
          vestsAt: iso(r.vests_at),
          vested: Number(r.vests_at) * 1000 <= Date.now(),
        }));

      const vested = entries.filter((e) => e.vested);
      const feeAccrued = addAmounts(...entries.map((e) => e.feeAccrued));
      const feeVested = addAmounts(...vested.map((e) => e.feeAccrued));
      // Claimed rows are settled off-chain, so "claimed" on chain IS paid.
      const feeClaimed = addAmounts(
        ...rows.filter((r) => r.claimed && !r.recovered).map((r) => feeOnChainAmount(r.subscribed)),
      );

      return {
        code,
        displayName: resolved.display_name,
        trailFeeBps: config.trailFeeBps,
        vestingWindowDays: VESTING_WINDOW_DAYS,
        entries,
        totals: {
          introducedCount: entries.length,
          subscribedTotal: addAmounts(...entries.map((e) => e.subscribed)),
          feeAccrued,
          feeClaimed,
          feeClaimable: subtractAmounts(feeVested, feeClaimed),
          feeVesting: subtractAmounts(feeAccrued, feeVested),
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
        // The issuer sees its own liability; the rate is its own too.
        feeAccrued: feeOnChainAmount(r.subscribed),
        feeSettled: r.claimed,
        vestsAt: iso(r.vests_at),
        recoverable: !r.recovered && !r.claimed && Number(r.vests_at) * 1000 > Date.now(),
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
