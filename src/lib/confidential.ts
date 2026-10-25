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
  spongeSqueeze2,
  type KeyPair,
  type NoirInputs,
  type Point,
} from 'stellar-confidential-token-sdk';
import { permute } from '@zkpassport/poseidon2';

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
