/** The shapes the server hands the client. Mirrors site/server/loaders.mjs. */

export type RowState = 'vesting' | 'payable' | 'paid' | 'reversed';

export interface Row {
  id: number;
  code: string;
  investor: string;
  subscribed: string;
  units: string;
  at: string;
  vestsAt: string;
  state: RowState;
}

export interface Activity {
  id: string;
  asset: string;
  kind: 'issued' | 'received' | 'sent';
  direction: 'in' | 'out';
  amount: string;
  counterparty: string | null;
  ledger: number;
  at: string;
}

export interface WalletState {
  address: string;
  balances: { usdc: string; usdcRaw: string; units: string; unitsRaw: string };
  activity: Activity[];
  passkeys: number;
  positions: Row[];
}

export interface Introducer {
  code: string;
  owner: string;
  displayName: string;
}

export interface Stats {
  subscribed: string;
  investors: number;
  advisers: number;
  introductions: number;
  reversed: number;
}

export interface Fund {
  manager: string;
  shortManager: string;
  name: string;
  unitCode: string;
  unitName: string;
  subscriptionAsset: string;
  unitPrice: string;
  minimumSubscription: number;
  domicile: string;
  regulator: string;
  licence: string;
  isin: string;
  inceptionYear: number;
  strategy: string;
}

export interface PageData {
  fund: Fund;
  rpId: string;
  contracts: { rails: string; usdc: string; unit: string };
  session: { walletAddress: string | null; code: string | null };
  stats?: Stats;
  wallet?: WalletState | null;
  introducer?: Introducer | null;
  book?: { rows: Row[]; claimableBasis: string };
  advisers?: (Introducer & { introductions: number })[];
}

export interface Route {
  name: string;
  params: Record<string, string>;
  path: string;
}
