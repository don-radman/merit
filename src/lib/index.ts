/**
 * The swap point.
 * =========================================================================
 * The UI imports from here and nowhere else:
 *
 *   import { createClient, formatAmount } from '../lib';
 *
 * Today every method is served by the stub. As each contract method lands,
 * implement it in `live.ts` and flip MODE — the UI does not change.
 */

import { createStubClient } from './stub.ts';
import type { ClientConfig, IntroducerRailsClient } from './types.ts';

export * from './types.ts';
export { setStubFailure } from './stub.ts';
export { FUND, TRAIL_FEE_BPS, linkFor } from './fixtures.ts';

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

export function createClient(config: ClientConfig): IntroducerRailsClient {
  if (MODE === 'live') {
    throw new Error(
      'Live client not wired yet. Add src/lib/live.ts implementing ' +
        'IntroducerRailsClient, import it here, and return it from createClient.',
    );
  }
  return createStubClient(config);
}
