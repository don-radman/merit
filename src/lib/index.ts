/**
 * The swap point.
 * =========================================================================
 * The UI imports from here and nowhere else:
 *
 *   import { createClient, formatAmount } from '@/lib';
 *
 * Today every method is served by the stub. As each contract method lands,
 * implement it in `live.ts` and flip MODE — the UI does not change.
 */

import { createStubClient } from '@/lib/stub.ts';
import { createLiveClient } from '@/lib/live.ts';
import type { ClientConfig, IntroducerRailsClient } from '@/lib/types.ts';

export * from '@/lib/types.ts';
export { setStubFailure } from '@/lib/stub.ts';
export { FUND, TRAIL_FEE_BPS, linkFor } from '@/lib/fixtures.ts';

export type ClientMode = 'stub' | 'live';

const envMode = (() => {
  try {
    return (import.meta as unknown as { env?: Record<string, string> })?.env
      ?.VITE_CLIENT_MODE as ClientMode | undefined;
  } catch {
    return undefined;
  }
})();

/** Flip to 'live', or set VITE_CLIENT_MODE=live, once contracts are deployed. */
export const MODE: ClientMode = envMode ?? 'stub';

const env = (k: string, fallback: string): string => {
  try {
    const v = (import.meta as unknown as { env?: Record<string, string> })?.env?.[k];
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

/** The deployed contract. Override with VITE_CONTRACT_ID. */
export const CONTRACT_ID = env('VITE_CONTRACT_ID', 'CC6RQUT2FCWQS26ESG3TL4MG2TPPXGUTTSCPV4KOVBRD3OCCOG7FRA7C');

export function createClient(config: ClientConfig): IntroducerRailsClient {
  if (MODE === 'live') {
    return createLiveClient({
      ...config,
      contractId: CONTRACT_ID,
      // Simulation source only — never signs. Any existing account works.
      readSource: env('VITE_READ_SOURCE', 'GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ'),
      rpcUrl: env('VITE_RPC_URL', 'https://soroban-testnet.stellar.org'),
      // The introducer's OWN rate, held locally. Never read from the chain.
      trailFeeBps: Number(env('VITE_TRAIL_FEE_BPS', '50')),
    });
  }
  return createStubClient(config);
}

export { liveMethods } from '@/lib/live.ts';
