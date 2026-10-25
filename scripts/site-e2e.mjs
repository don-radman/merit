/**
 * End-to-end proof of the passkey wallet, against testnet.
 *
 *   node scripts/site-e2e.mjs
 *
 * The browser's part of this flow is one call to `navigator.credentials.get()`,
 * and the one thing a headless script cannot do is touch a secure element. So
 * this substitutes a simulated authenticator that produces byte-identical
 * payloads: the same authenticatorData layout, the same clientDataJSON shape,
 * the same DER signature over the same digest. Everything downstream of it —
 * the authorization entry, the contract's `__check_auth`, the submitted
 * transaction — is the real thing on the real network.
 *
 * What this proves that the Rust host tests cannot: that a passkey assertion
 * actually satisfies `require_auth` through the host's own authorization
 * machinery, that the derived wallet address matches the deployed one, and
 * that an investor who holds nothing but a passkey can move money.
 */
import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import {
  derToCompactSignature,
  spkiToUncompressedPoint,
  toBase64Url,
} from '../site/src/wallet/webauthn-sig.mjs';
import { CONTRACTS, FUND, RP, assertConfigured, rpIdHash } from '../site/server/config.mjs';
import { balances, positionsFor, read, relayerKeypair, str } from '../site/server/chain.mjs';
import {
  creditSubscriptionAccount,
  deployWallet,
  prepare,
  submit,
  walletAddressFor,
  walletDeployed,
} from '../site/server/relayer.mjs';

const CODE = 'CALDER-PR7';
const SUBSCRIPTION = '75000.00';
const FLOAT = '120000.00';

const bold = (s) => `\u001b[1m${s}\u001b[0m`;
const step = (s) => console.log(`\n${bold('── ' + s)}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const info = (s) => console.log(`    ${s}`);

function assert(condition, message) {
  if (!condition) throw new Error(`FAILED: ${message}`);
}

/**
 * Stands in for Touch ID. Produces exactly what a browser produces.
 */
class SimulatedAuthenticator {
  constructor(label) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    this.label = label;
    this.privateKey = privateKey;
    this.publicKey = spkiToUncompressedPoint(publicKey.export({ type: 'spki', format: 'der' }));
    // Real credential ids are opaque authenticator-chosen bytes.
    this.credentialId = randomBytes(32);
    this.counter = 0;
  }

  /** The browser's `navigator.credentials.get({ challenge })`. */
  assert(challenge) {
    this.counter += 1;
    const authenticatorData = Buffer.concat([
      rpIdHash(),
      Buffer.from([0x01 | 0x04]), // user present | user verified
      Buffer.from([0, 0, 0, this.counter]),
    ]);
    const clientDataJSON = Buffer.from(
      JSON.stringify({
        type: 'webauthn.get',
        challenge,
        origin: RP.id === 'localhost' ? 'http://localhost:5174' : `https://${RP.id}`,
        crossOrigin: false,
      }),
    );
    const digestInput = Buffer.concat([
      authenticatorData,
      createHash('sha256').update(clientDataJSON).digest(),
    ]);
    const der = createSign('sha256').update(digestInput).sign(this.privateKey);
    return {
      credentialId: toBase64Url(this.credentialId),
      authenticatorData: toBase64Url(authenticatorData),
      clientDataJSON: toBase64Url(clientDataJSON),
      signature: toBase64Url(derToCompactSignature(der)),
    };
  }
}

/** One full prepare -> touch -> submit round trip. */
async function authorize(walletAddress, intent, authenticator) {
  const prepared = await prepare({ walletAddress, intent });
  info(`challenge ${prepared.challenge.slice(0, 16)}… (${prepared.summary.title})`);
  const assertion = authenticator.assert(prepared.challenge);
  return submit({ requestId: prepared.requestId, assertion });
}

assertConfigured();

step('Setup');
info(`relying party   ${RP.id}`);
info(`fund            ${FUND.name}`);
info(`rails           ${CONTRACTS.rails}`);
info(`relayer         ${relayerKeypair().publicKey()}`);

step('An investor creates a passkey');
const phone = new SimulatedAuthenticator('iPhone');
info(`credential id   ${toBase64Url(phone.credentialId).slice(0, 24)}…`);
info(`public key      ${Buffer.from(phone.publicKey).toString('hex').slice(0, 24)}… (65 bytes)`);

step('Their wallet address is derived, not stored');
const derived = walletAddressFor(phone.credentialId);
info(derived);
assert(!(await walletDeployed(derived)), 'a fresh credential should have no wallet yet');
ok('derived from sha256(credential id); nothing was written down to get it');

step('Deploy the wallet, paid for by the relayer');
const deployed = await deployWallet({
  credentialId: phone.credentialId,
  publicKey: phone.publicKey,
});
assert(deployed.address === derived, `deployed ${deployed.address} != derived ${derived}`);
ok(`deployed at the derived address — so "sign in" needs no database`);
info(`tx ${deployed.hash}`);
assert(Number(await read(derived, 'signers')) === 1, 'wallet should hold exactly one passkey');
assert(
  Buffer.from(await read(derived, 'rp_id')).equals(rpIdHash()),
  'wallet should be bound to this relying party',
);
ok('one signer, bound to ' + RP.id);

step('A wire clears');
const credited = await creditSubscriptionAccount({ address: derived, amount: FLOAT });
info(`tx ${credited.hash}`);
const funded = await balances(derived);
assert(funded.usdc === FLOAT, `expected ${FLOAT} USDC, got ${funded.usdc}`);
ok(`${funded.usdc} USDC, with no trustline and no setup transaction`);

step('Subscribe — authorized by the passkey alone');
const before = await balances(derived);
const result = await authorize(
  derived,
  { kind: 'subscribe', code: CODE, amount: SUBSCRIPTION, introducerName: 'Raghunathan Family Office' },
  phone,
);
info(`tx ${result.hash}`);
const after = await balances(derived);
info(`USDC  ${before.usdc} → ${after.usdc}`);
info(`CSDIF ${before.units} → ${after.units}`);
assert(after.units === SUBSCRIPTION, `expected ${SUBSCRIPTION} units, got ${after.units}`);
assert(Number(after.usdc) === Number(before.usdc) - Number(SUBSCRIPTION), 'USDC did not move');
ok('money moved on an authorization the server could not have produced');

const positions = await positionsFor(derived);
assert(positions.length === 1, `expected one attribution, got ${positions.length}`);
assert(positions[0].code === CODE, 'attribution carries the wrong code');
ok(`attribution #${positions[0].id} recorded against ${positions[0].code}, state "${positions[0].state}"`);

step('Send USDC to someone else');
const destination = relayerKeypair().publicKey();
const sent = await authorize(
  derived,
  { kind: 'transfer', asset: 'usdc', to: destination, amount: '1000.00' },
  phone,
);
info(`tx ${sent.hash}`);
const afterSend = await balances(derived);
assert(
  Number(afterSend.usdc) === Number(after.usdc) - 1000,
  `expected ${Number(after.usdc) - 1000}, got ${afterSend.usdc}`,
);
ok(`${afterSend.usdc} USDC left`);

step('Add a second device, then revoke the first');
const laptop = new SimulatedAuthenticator('MacBook');
await authorize(
  derived,
  {
    kind: 'addPasskey',
    credentialId: toBase64Url(laptop.credentialId),
    publicKey: toBase64Url(laptop.publicKey),
    label: 'MacBook',
  },
  phone,
);
assert(Number(await read(derived, 'signers')) === 2, 'expected two signers');
ok('two passkeys on one wallet');

// The new device has to be able to act on its own, or it is not a recovery
// path — it is a decoration.
await authorize(
  derived,
  { kind: 'transfer', asset: 'usdc', to: destination, amount: '500.00' },
  laptop,
);
ok('the second passkey can spend');

await authorize(
  derived,
  { kind: 'removePasskey', credentialId: toBase64Url(phone.credentialId), label: 'iPhone' },
  laptop,
);
assert(Number(await read(derived, 'signers')) === 1, 'expected one signer after revocation');
assert(
  (await read(derived, 'has_signer', [
    (await import('@stellar/stellar-sdk')).nativeToScVal(Buffer.from(phone.credentialId), { type: 'bytes' }),
  ])) === false,
  'the revoked credential should be gone',
);
ok('lost phone revoked by the laptop');

step('A revoked passkey is refused');
let refused = false;
try {
  await authorize(derived, { kind: 'transfer', asset: 'usdc', to: destination, amount: '1.00' }, phone);
} catch (e) {
  refused = true;
  info(String(e.message).split('\n')[0].slice(0, 120));
}
assert(refused, 'the revoked phone should not have been able to spend');
ok('refused, as it must be');

step('Result');
const finalBalances = await balances(derived);
console.log(`  wallet   ${derived}`);
console.log(`  USDC     ${finalBalances.usdc}`);
console.log(`  ${FUND.unitCode}    ${finalBalances.units}`);
console.log(`  passkeys ${await read(derived, 'signers')}`);
console.log(`\n${bold('Everything above was authorized by a passkey and nothing else.')}\n`);
