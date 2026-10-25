/**
 * Register a confidential account — witness and payload halves.
 *
 *   node scripts/conf-register.mjs <token> toml <out.toml>
 *   node scripts/conf-register.mjs <token> data <out.bin> <proof>
 *
 * Reads the signer's secret from IR_SECRET. The SDK's own bundled circuits are
 * the stale developer-preview ones, so the proving happens against
 * OpenZeppelin's current circuits via nargo/bb in between the two halves —
 * see scripts/confidential.sh.
 */
import {
  skSigningMessage, sep53Payload, deriveSk, deriveKeys,
  buildRegisterWitness, encodeRegisterData,
} from 'stellar-confidential-token-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import { writeFileSync, readFileSync } from 'node:fs';

const [token, mode, out, proofPath] = process.argv.slice(2);
if (!process.env.IR_SECRET) throw new Error('IR_SECRET not set');

const kp = Keypair.fromSecret(process.env.IR_SECRET);
const account = kp.publicKey();
const root = kp.sign(Buffer.from(sep53Payload(skSigningMessage(token, account))));
const d = deriveSk(root, token, account);
const keys = deriveKeys(d.sk, d.addrF, d.acctF);
const w = buildRegisterWitness(keys, d.acctF);

if (mode === 'toml') {
  const names = ['sk', 'y_x', 'y_y', 'pvk_x', 'pvk_y', 'addr_f', '_acct_f'];
  const lines = names.map((n) => {
    const v = w.inputs[n] ?? w.inputs[n.replace(/^_/, '')];
    if (v === undefined) throw new Error(`witness missing ${n}`);
    return `${n} = "${v}"`;
  });
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`  witness written for ${account.slice(0, 8)}…`);
} else {
  const proof = new Uint8Array(readFileSync(proofPath));
  const scv = encodeRegisterData(w, proof);
  writeFileSync(out, Buffer.from(scv.bytes()));
  console.log(`  register data: ${scv.bytes().length} bytes`);
}
