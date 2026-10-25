/**
 * Confidential settlement: the issuer pays one introducer, privately.
 *
 *   node scripts/conf-settle.mjs <token> witness <v> <r> <amount> <pvkB-hex> <kAud-hex> <work>
 *   node scripts/conf-settle.mjs <token> data <work>
 *
 * Two halves, because the proving happens in between against OpenZeppelin's
 * CURRENT transfer circuit — the SDK's bundled one is the stale preview.
 *
 * The SDK is one field short in BOTH places, and `src/lib/confidential.ts`
 * covers both: `completeWitness` supplies `r_tilde_aud_s` for the proof, and
 * `completeTransferData` emits the 11-field payload the contract wants where
 * the SDK's own `encodeTransferData` emits 10. Do not call the SDK's encoder.
 *
 * This file used to hand-roll that struct. It was verified byte-for-byte
 * against `completeTransferData` before being deleted — identical output, so
 * there is one encoder now rather than two that can drift.
 *
 * `amount` is the commission. It is computed off-chain from the introducer's
 * privately negotiated rate — the chain never sees the rate, and after this
 * runs it never sees the amount either.
 */
import {
  skSigningMessage, sep53Payload, deriveSk, deriveKeys,
  buildTransferWitness, pointFromBytes, pointToBytes,
} from 'stellar-confidential-token-sdk';
import { completeWitness, completeTransferData } from '../src/lib/confidential.ts';
import { Keypair } from '@stellar/stellar-sdk';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [token, mode, ...rest] = process.argv.slice(2);
if (!process.env.IR_SECRET) throw new Error('IR_SECRET not set');

const kp = Keypair.fromSecret(process.env.IR_SECRET);
const account = kp.publicKey();
const root = kp.sign(Buffer.from(sep53Payload(skSigningMessage(token, account))));
const d = deriveSk(root, token, account);
const keys = deriveKeys(d.sk, d.addrF, d.acctF);

const hexPoint = (h) => pointFromBytes(new Uint8Array(Buffer.from(h, 'hex')));
const b32 = (v) => Buffer.from(BigInt(v).toString(16).padStart(64, '0'), 'hex');
const b64 = (p) => Buffer.from(pointToBytes(p));

if (mode === 'witness') {
  const [v, r, amount, pvkBHex, kAudHex, work] = rest;
  const kAudS = hexPoint(kAudHex);

  const w = buildTransferWitness({
    keys,
    v: BigInt(v),
    r: BigInt(r),
    amount: BigInt(amount),
    pvkB: hexPoint(pvkBHex),
    kAudR: kAudS,
    kAudS,
  });

  const inputs = completeWitness(w.inputs, keys, kAudS);
  writeFileSync(
    join(work, 'Prover.toml'),
    Object.entries(inputs).map(([k, val]) => `${k} = "${val}"`).join('\n') + '\n',
  );

  // Persist everything the payload half needs, so it never re-derives and can
  // never disagree with the witness the proof was built from.
  writeFileSync(join(work, 'witness.json'), JSON.stringify({
    rTildeAudS: inputs.r_tilde_aud_s,
    payload: {
      c_spend_new: b64(w.payload.cSpendNew).toString('hex'),
      c_transfer: b64(w.payload.cTx).toString('hex'),
      r_e_point: b64(w.payload.rE).toString('hex'),
      v_tilde: b32(w.payload.vTilde).toString('hex'),
      b_tilde: b32(w.payload.bTilde).toString('hex'),
      sigma: b32(w.payload.sigma).toString('hex'),
      v_tilde_aud_r: b32(w.payload.vAudR).toString('hex'),
      r_tilde_aud_r: b32(w.payload.rAudR).toString('hex'),
      v_tilde_aud_s: b32(w.payload.vAudS).toString('hex'),
      b_tilde_aud_s: b32(w.payload.bAudS).toString('hex'),
    },
    next: { v: w.next.v.toString(), r: w.next.r.toString() },
  }, null, 2));
  console.log(`  witness: ${Object.keys(inputs).length} params (SDK gives ${Object.keys(w.inputs).length})`);
} else {
  const [work] = rest;
  const saved = JSON.parse(readFileSync(join(work, 'witness.json'), 'utf8'));
  const proof = new Uint8Array(readFileSync(join(work, 'proof')));

  const pt = (hex) => pointFromBytes(new Uint8Array(Buffer.from(hex, 'hex')));
  const fe = (hex) => BigInt('0x' + hex);
  const p = saved.payload;

  const data = completeTransferData(
    {
      cSpendNew: pt(p.c_spend_new), cTx: pt(p.c_transfer), rE: pt(p.r_e_point),
      vTilde: fe(p.v_tilde), bTilde: fe(p.b_tilde), sigma: fe(p.sigma),
      vAudR: fe(p.v_tilde_aud_r), rAudR: fe(p.r_tilde_aud_r),
      vAudS: fe(p.v_tilde_aud_s), bAudS: fe(p.b_tilde_aud_s),
    },
    BigInt(saved.rTildeAudS),
    proof,
  );

  writeFileSync(join(work, 'data.bin'), Buffer.from(data));
  console.log(`  TransferData: 11-field payload + ${proof.length}-byte proof`);
  // The opening is written to contracts/.conf-state by the caller. It is NOT
  // logged: (v, r) spends the pool, and consecutive v values differ by the
  // commission, which gives up the rate.
  console.log('  next opening computed (written to .conf-state, not logged)');
}
