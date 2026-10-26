/**
 * The swap point.
 * =========================================================================
 * The UI imports from here and nowhere else:
 *
 *   import { createClient, formatAmount } from '@/lib';
 *
 * Reads are live against the deployed contract; writes are still the stub,
 * because no signer exists in this client. `liveMethods` in live.ts is the
 * authority on which is which. As each write lands, implement it there — the
 * UI does not change.
 */

import { createStubClient } from '@/lib/stub.ts';
// The live client pulls in the Stellar SDK, which the stub never needs. Load
// it only when live mode is on, so a stub build ships without the SDK chunk.
// Top-level await: the module resolves before any screen renders.
const live = import.meta.env.VITE_CLIENT_MODE === 'live' ? await import('@/lib/live.ts') : null;
import { INTRODUCERS, TRAIL_FEE_BPS, rateFor } from '@/lib/fixtures.ts';
import type { ClientConfig, IntroducerRailsClient } from '@/lib/types.ts';

export * from '@/lib/types.ts';
export { setStubFailure, stubAdvanceVesting, setStubPayoutsReady, onStubChange } from '@/lib/stub.ts';
export { FUND, PRODUCT, TRAIL_FEE_BPS, VESTING_WINDOW_DAYS, linkFor } from '@/lib/fixtures.ts';

export type ClientMode = 'stub' | 'live';

// Canonical form on purpose: Vite replaces `import.meta.env.VITE_*` at build
// time by matching that exact expression. Wrapping it in a cast or optional
// chaining defeats the substitution and the value silently comes back
// undefined — which is how this spent a restart reading 'stub'.
const envMode = import.meta.env.VITE_CLIENT_MODE as ClientMode | undefined;

/** Flip to 'live', or set VITE_CLIENT_MODE=live, once contracts are deployed. */
export const MODE: ClientMode = envMode ?? 'stub';

const env = (v: string | undefined, fallback: string): string => v ?? fallback;

/** The deployed contract. Override with VITE_CONTRACT_ID. */
export const CONTRACT_ID = env(
  import.meta.env.VITE_CONTRACT_ID,
  'CDENXKDNNRLQ7F3C7VI3EWFPJBUMO5L6BDV2CZE6LSCP47G5JUGTPJT4',
);

/**
 * The rate THIS client applies, and the only one it is given.
 *
 * `VITE_TRAIL_FEE_BPS` wins when it is set, because a real introducer's
 * deployment is configured with their own agreed terms and nothing else. With
 * it unset — the demo, where one browser plays every role and switches codes
 * from the dev bar — fall back to the local table for the code being opened,
 * so each book shows its own rate instead of whichever one happened to be in
 * the environment.
 *
 * Note it resolves to a SINGLE number, never the table: a client that opens
 * CALDER-DO2's book is handed 70 bps and no way to discover anyone else's.
 */
function ownRateFor(config: ClientConfig): number {
  const configured = import.meta.env.VITE_TRAIL_FEE_BPS;
  if (configured !== undefined) return Number(configured);
  return config.code ? rateFor(config.code) : TRAIL_FEE_BPS;
}

export function createClient(config: ClientConfig): IntroducerRailsClient {
  if (MODE === 'live') {
    if (!live) throw new Error('Live client was not loaded; VITE_CLIENT_MODE must be set at build time.');
    return live.createLiveClient({
      ...config,
      contractId: CONTRACT_ID,
      // Simulation source only — never signs. Any existing account works.
      readSource: env(
        import.meta.env.VITE_READ_SOURCE,
        'GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ',
      ),
      rpcUrl: env(import.meta.env.VITE_RPC_URL, 'https://soroban-testnet.stellar.org'),
      // The introducer's OWN rate, held locally. Never read from the chain.
      trailFeeBps: ownRateFor(config),
      // Must match the deployment: the contract fixes this at `initialise` and
      // offers no getter. The seeded demo instance uses 300s; 7776000 is the
      // 90 days production would run.
      vestingWindowSecs: Number(env(import.meta.env.VITE_VESTING_WINDOW_SECS, '300')),
      // The issuer negotiated every rate and owes every rate, so its ledger
      // needs the table. An introducer's client is given none, leaving it with
      // its own `trailFeeBps` and no way to cost anyone else's book.
      //
      // Demo-only source: in production this comes from the issuer's own
      // systems, which is where the agreements live. It is never on chain.
      rates:
        config.role === 'issuer' || config.role === 'auditor'
          ? Object.fromEntries(INTRODUCERS.map((i) => [i.code, i.trailFeeBps]))
          : undefined,
    });
  }
  return createStubClient(config);
}

/** Which methods read the chain. Empty in stub mode — nothing is live. */
export const liveMethods: readonly string[] = live ? live.liveMethods : [];
