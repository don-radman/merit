/**
 * The one witness field the SDK does not emit.
 * =========================================================================
 * `stellar-confidential-token-sdk@0.1.9` tracks OpenZeppelin's developer
 * preview. v0.8.0 added a third sender-auditor mask lane, so its witness
 * builders come up one parameter short on `transfer` and `withdraw`:
 *
 *   T_a9 / W_a5:  r_tilde_aud_s = r_new + m_s[2]
 *   m_s   = sponge_squeeze_3(AUDITOR_SENDER, ecdh(r_e, k_aud_s), sigma)
 *   r_new = derive_spend_r(vk, sigma)
 *
 * Every term is deterministic — nothing here invents a nonce. OpenZeppelin
 * states that `sponge_squeeze_3(..)[0..2] == sponge_squeeze_2(..)` by
 * construction (one rate-3 absorb block, same permutation), so the SDK's
 * existing auditor values stay valid and only lane 2 is missing.
 *
 * THE SAME FIELD IS MISSING IN TWO PLACES, and it took a live transfer to find
 * the second one:
 *
 *   1. `inputs.r_tilde_aud_s`   — needed to PROVE   (`completeWitness`)
 *   2. `payload.r_tilde_aud_s`  — needed ON CHAIN   (`completeTransferData`)
 *
 * `TransferWitness.payload` carries 10 fields; v0.8.0's `TransferPayload` has
 * 11. So `encodeTransferData` from the SDK emits an envelope the contract
 * rejects, even when the proof itself is perfect.
 *
 * **Do not call the SDK's `encodeTransferData`.** Use `completeTransferData`
 * below, which emits all eleven.
 *
 * `register` is unaffected: it has no auditor channel.
 *
 * Verified end to end: both completed witnesses solve their circuit under
 * `nargo execute`, and the resulting proofs are accepted by OpenZeppelin's
 * verifier deployed on testnet.
 *
 * DELETE THIS FILE when the SDK ships a build against v0.8.0 circuits.
 */

import {
  DOMAIN,
  POSEIDON2_IV_BASE,
  deriveSpendR,
  ecdh,
  frAdd,
  pointToBytes,
  scvStruct,
  spongeSqueeze2,
  toBytes32BE,
  type KeyPair,
  type NoirInputs,
  type Point,
} from 'stellar-confidential-token-sdk';
import { permute } from '@zkpassport/poseidon2';
import { xdr } from '@stellar/stellar-sdk';

/** All three sender-auditor masks, including the lane the SDK omits. */
export function senderAuditorMasks(
  rE: bigint,
  kAudS: Point,
  sigma: bigint,
): [bigint, bigint, bigint] {
  const sAS = ecdh(rE, kAudS);
  const state = permute([DOMAIN.AUDITOR_SENDER, sAS, sigma, 3n * POSEIDON2_IV_BASE]);
  const masks: [bigint, bigint, bigint] = [state[0], state[1], state[2]];

  // If the SDK's sponge ever diverges from ours, fail here rather than emit a
  // witness that silently produces a rejected — or unsound — proof.
  const [a, b] = spongeSqueeze2(DOMAIN.AUDITOR_SENDER, sAS, sigma);
  if (a !== masks[0] || b !== masks[1]) {
    throw new Error(
      'confidential: sender-auditor masks no longer match the SDK. The SDK or ' +
        "OpenZeppelin's sponge changed — re-derive before trusting any proof.",
    );
  }
  return masks;
}

/**
 * Add `r_tilde_aud_s` to a witness from `buildTransferWitness` or
 * `buildWithdrawWitness`. `keys` and `sigma` come from the same derivation
 * that produced the witness.
 */
export function completeWitness(inputs: NoirInputs, keys: KeyPair, kAudS: Point): NoirInputs {
  const sigma = BigInt(inputs.sigma);
  const rE = BigInt(inputs.r_e);
  const masks = senderAuditorMasks(rE, kAudS, sigma);
  const rTilde = frAdd(deriveSpendR(keys.vk, sigma), masks[2]);
  return { ...inputs, r_tilde_aud_s: '0x' + rTilde.toString(16).padStart(64, '0') };
}


/**
 * The fields `buildTransferWitness` puts on its payload, in the SDK's own
 * camelCase. Typed structurally because the SDK does not export the shape.
 */
export interface TransferPayloadParts {
  cSpendNew: Point;
  cTx: Point;
  rE: Point;
  vTilde: bigint;
  bTilde: bigint;
  sigma: bigint;
  vAudR: bigint;
  rAudR: bigint;
  vAudS: bigint;
  bAudS: bigint;
}

/**
 * Encode a transfer's `data: Bytes` argument with ALL ELEVEN payload fields.
 *
 * Replaces the SDK's `encodeTransferData`, which emits ten and produces an
 * envelope v0.8.0's contract rejects.
 *
 * ON `.toXDR()` vs `.bytes()` — THE RULE IS NOT "ALWAYS `.bytes()`". It depends
 * on what you are holding:
 *
 *   SDK `encodeRegisterData`  returns `scvBytes(struct.toXDR())` — already
 *                             wrapped, so the caller takes `.bytes()`
 *   a hand-built `scvStruct`  IS the struct — so you take `.toXDR()`
 *
 * This function hand-builds, so `.toXDR()` below is correct. **Do not "fix" it
 * to `.bytes()`** — `.bytes()` on a raw struct is not the same value and the
 * contract will reject it with InvalidData (3507).
 */
export function completeTransferData(
  payload: TransferPayloadParts,
  rTildeAudS: bigint,
  proof: Uint8Array,
): Uint8Array {
  const pt = (p: Point) => xdr.ScVal.scvBytes(Buffer.from(pointToBytes(p)));
  const fd = (x: bigint) => xdr.ScVal.scvBytes(Buffer.from(toBytes32BE(x)));

  const inner = scvStruct({
    c_spend_new: pt(payload.cSpendNew),
    c_transfer: pt(payload.cTx),
    r_e_point: pt(payload.rE),
    v_tilde: fd(payload.vTilde),
    b_tilde: fd(payload.bTilde),
    sigma: fd(payload.sigma),
    v_tilde_aud_r: fd(payload.vAudR),
    r_tilde_aud_r: fd(payload.rAudR),
    v_tilde_aud_s: fd(payload.vAudS),
    b_tilde_aud_s: fd(payload.bAudS),
    // The eleventh. Same value as inputs.r_tilde_aud_s — see completeWitness.
    r_tilde_aud_s: fd(rTildeAudS),
  });

  const envelope = scvStruct({
    payload: inner,
    proof: xdr.ScVal.scvBytes(Buffer.from(proof)),
  });
  return new Uint8Array(envelope.toXDR());
}

/** The value both gaps need, so a caller computes it once. */
export function transferRTildeAudS(inputs: NoirInputs, keys: KeyPair, kAudS: Point): bigint {
  const sigma = BigInt(inputs.sigma);
  const masks = senderAuditorMasks(BigInt(inputs.r_e), kAudS, sigma);
  return frAdd(deriveSpendR(keys.vk, sigma), masks[2]);
}
