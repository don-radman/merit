/**
 * One-time setup for the site's own Stellar key.
 *
 *   node scripts/site-setup.mjs
 *
 * The site holds exactly one key, with exactly two jobs: pay transaction fees,
 * and disburse the testnet USDC float that stands in for a cleared wire. It is
 * generated here and written straight to site/.env.local (gitignored, mode
 * 600). It is never printed, and the fund issuer's own key is never read by
 * the web server at all — which is the arrangement you would actually want in
 * production, where the issuer's signing key belongs nowhere near a web tier.
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  Account,
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';

const ENV_PATH = new URL('../site/.env.local', import.meta.url);
const WASM_PATH = new URL('../target/wasm32v1-none/release/passkey_wallet.wasm', import.meta.url);

const existing = existsSync(ENV_PATH)
  ? Object.fromEntries(
      readFileSync(ENV_PATH, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
  : {};

let keypair;
if (existing.RELAYER_SECRET) {
  keypair = Keypair.fromSecret(existing.RELAYER_SECRET);
  console.log('relayer   reusing existing key');
} else {
  keypair = Keypair.random();
  console.log('relayer   generated a new key');
}

// The wasm hash IS the sha256 of the uploaded file, so it never has to be
// copied by hand from an upload's output.
const wasmHash = createHash('sha256').update(readFileSync(WASM_PATH)).digest('hex');

const lines = [
  '# Written by scripts/site-setup.mjs. Gitignored. Do not commit.',
  '# The site holds this one key to pay fees and disburse the testnet float.',
  `RELAYER_SECRET=${keypair.secret()}`,
  `PASSKEY_WASM_HASH=${wasmHash}`,
  `RP_ID=${existing.RP_ID ?? 'localhost'}`,
  '',
];
writeFileSync(ENV_PATH, lines.join('\n'));
chmodSync(ENV_PATH, 0o600);

console.log('wasm hash', wasmHash);
console.log('relayer   ' + keypair.publicKey());

const funded = await fetch(`https://friendbot.stellar.org?addr=${keypair.publicKey()}`);
console.log('friendbot', funded.ok ? 'funded' : `already funded (${funded.status})`);

/**
 * The subscription currency is a classic Stellar asset wrapped as a SAC, so a
 * `G` account has to hold a trustline before it can be credited. Contract
 * addresses do not — which is exactly why an investor's passkey wallet needs
 * no setup step of its own and can simply be paid.
 */
const ASSET = new Asset('TUSDC', 'GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ');
const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
const account = await horizon.loadAccount(keypair.publicKey());
const already = account.balances.some(
  (b) => b.asset_code === ASSET.getCode() && b.asset_issuer === ASSET.getIssuer(),
);

if (already) {
  console.log('trustline  already present');
} else {
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: ASSET }))
    .setTimeout(60)
    .build();
  tx.sign(keypair);
  await horizon.submitTransaction(tx);
  console.log('trustline  established for ' + ASSET.getCode());
}

/**
 * Every investor's wallet is an instance of one uploaded WASM, so the upload
 * has to exist before the first account can be opened. Checking rather than
 * always uploading keeps this idempotent, and means a fresh clone needs one
 * command instead of one command plus a remembered `stellar contract upload`.
 */
const soroban = new rpc.Server('https://soroban-testnet.stellar.org');
const codeKey = xdr.LedgerKey.contractCode(
  new xdr.LedgerKeyContractCode({ hash: Buffer.from(wasmHash, 'hex') }),
);
const onChain = await soroban.getLedgerEntries(codeKey);

if (onChain.entries?.length) {
  console.log('wasm       already uploaded to testnet');
} else {
  console.log('wasm       uploading to testnet…');
  const source = await soroban.getAccount(keypair.publicKey());
  const built = new TransactionBuilder(source, {
    fee: '1000000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: readFileSync(WASM_PATH) }))
    .setTimeout(120)
    .build();
  const sim = await soroban.simulateTransaction(built);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const prepared = rpc.assembleTransaction(built, sim).build();
  prepared.sign(keypair);
  const sent = await soroban.sendTransaction(prepared);
  let got = await soroban.getTransaction(sent.hash);
  const deadline = Date.now() + 45_000;
  while (got.status === 'NOT_FOUND' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await soroban.getTransaction(sent.hash);
  }
  if (got.status !== 'SUCCESS') throw new Error(`upload ended ${got.status}`);
  console.log('wasm       uploaded, tx ' + sent.hash);
}

console.log('\nNext, mint the testnet float to the relayer (the issuer key stays in the CLI):');
console.log(
  `  stellar contract invoke --id $(grep '^USDC_SAC=' .contract-id | cut -d= -f2) \\\n` +
    `    --source ir-issuer --network testnet --send=yes \\\n` +
    `    -- mint --to ${keypair.publicKey()} --amount 200000000000000`,
);
