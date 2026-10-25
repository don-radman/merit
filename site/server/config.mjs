/**
 * Everything the server needs to know about the chain and the brand.
 *
 * Contract ids come from `.contract-id`, which is committed because contract
 * ids are public. Secrets come from `site/.env.local`, which is not: the
 * pattern `.env.local` is gitignored at any depth. `scripts/site-env.sh`
 * writes that file from the stellar CLI's own identities, so no key is ever
 * typed into a source file.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const SITE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const REPO_ROOT = dirname(SITE_DIR);

/** Parse a KEY=VALUE file, ignoring blanks and comments. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

const ids = readEnvFile(join(REPO_ROOT, '.contract-id'));
const secrets = readEnvFile(join(SITE_DIR, '.env.local'));
const pick = (key, fallback) => process.env[key] ?? secrets[key] ?? fallback;

export const NETWORK = {
  passphrase: pick('NETWORK_PASSPHRASE', 'Test SDF Network ; September 2015'),
  rpcUrl: pick('RPC_URL', 'https://soroban-testnet.stellar.org'),
  name: 'Stellar testnet',
};

export const CONTRACTS = {
  /** Introducer Rails — attribution, vesting, settlement marking. */
  rails: pick('RAILS_ID', ids.CONTRACT),
  /** The subscription currency, as a Stellar Asset Contract. */
  usdc: pick('USDC_SAC', ids.USDC_SAC),
  /** The fund unit. */
  unit: pick('UNIT_SAC', ids.UNIT_SAC),
  /** Uploaded WASM every investor's wallet is an instance of. */
  passkeyWasmHash: pick('PASSKEY_WASM_HASH', ''),
};

export const KEYS = {
  /**
   * The only key this server holds.
   *
   * Two jobs: pay transaction fees, and disburse the testnet USDC float that
   * stands in for a cleared wire. It is NOT a custodian — it cannot move an
   * investor's funds, because an investor's wallet authorizes only a WebAuthn
   * assertion and this key has no passkey. All it can do is refuse to pay,
   * which is the right amount of power for the component that exists so an
   * investor never has to acquire XLM before they can buy a fund.
   *
   * Note what is deliberately absent: the fund issuer's signing key. That key
   * mints units and administers the asset, and it belongs nowhere near a web
   * tier. It stays in the operator's CLI.
   */
  relayer: pick('RELAYER_SECRET', ''),
};

/**
 * The WebAuthn relying party. A passkey is bound to this, and the wallet
 * contract stores its hash at construction, so a wallet created against
 * localhost cannot be driven from the production domain or the reverse. That
 * is a feature, not an inconvenience: it is what stops a lookalike domain
 * from using a credential it tricked somebody into creating.
 */
export const RP = {
  id: pick('RP_ID', 'localhost'),
  name: 'Calder Asset Management',
};

export const rpIdHash = () => createHash('sha256').update(RP.id).digest();

/** Decimal places on every classic Stellar asset, SACs included. */
export const STROOPS = 10_000_000n;

/** The brand. Kept in step with src/lib/fixtures.ts, which Dan's app uses. */
export const FUND = {
  manager: 'Calder Asset Management',
  shortManager: 'Calder',
  name: 'Calder Short‑Duration Income Fund',
  unitCode: 'CSDIF',
  unitName: 'Calder Short-Duration Income Fund units',
  subscriptionAsset: 'USDC',
  unitPrice: '1.00',
  minimumSubscription: 50_000,
  domicile: 'Singapore',
  regulator: 'Monetary Authority of Singapore',
  licence: 'CMS100000-0 (fictional)',
  isin: 'SGXZ00000000',
  inceptionYear: 2019,
  strategy:
    'A short-duration portfolio of investment-grade corporate and sovereign credit, ' +
    'managed to a weighted average maturity under eighteen months.',
};

export function assertConfigured() {
  const missing = [];
  for (const [k, v] of Object.entries({ ...CONTRACTS, ...KEYS })) if (!v) missing.push(k);
  if (missing.length) {
    throw new Error(
      `site: missing configuration: ${missing.join(', ')}.\n` +
        'Run: node scripts/site-setup.mjs',
    );
  }
}
