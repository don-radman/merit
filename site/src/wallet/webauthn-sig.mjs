/**
 * Turning a WebAuthn signature into something Soroban will accept.
 *
 * Plain ESM with no imports on purpose: the browser gets this through Vite and
 * the Node test harness imports the same file directly, so there is exactly
 * one implementation of the fiddly part and no chance of the two drifting.
 *
 * WebAuthn hands you a DER-encoded ECDSA signature. The Soroban host wants 64
 * raw bytes, `r ++ s`, and it rejects any signature whose `s` is in the upper
 * half of the curve order. Roughly half of all signatures land there, so
 * skipping the normalization produces a wallet that works about half the time
 * — which is far more confusing to debug than one that never works at all.
 */

/** The order of the secp256r1 (P-256) group. */
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const HALF_N = N / 2n;

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntTo32Bytes(value) {
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i -= 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Read one DER INTEGER at `offset`.
 *
 * DER integers are signed and minimally encoded, so a value whose top bit is
 * set carries a leading 0x00 that must be dropped, and a small value is
 * shorter than 32 bytes and must be left-padded. Doing either wrong yields a
 * signature that is the right length and still invalid.
 */
function readInteger(der, offset) {
  if (der[offset] !== 0x02) {
    throw new Error(`malformed DER signature: expected INTEGER at ${offset}`);
  }
  const length = der[offset + 1];
  const value = der.subarray(offset + 2, offset + 2 + length);
  return { value: bytesToBigInt(value), next: offset + 2 + length };
}

/**
 * DER ECDSA signature -> the 64 bytes the host verifies, low-S normalized.
 *
 * @param {Uint8Array} der
 * @returns {Uint8Array} 64 bytes
 */
export function derToCompactSignature(der) {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  if (bytes[0] !== 0x30) throw new Error('malformed DER signature: no SEQUENCE');
  // Skip the SEQUENCE header, allowing for a long-form length byte.
  let offset = 2;
  if (bytes[1] & 0x80) offset += bytes[1] & 0x7f;

  const r = readInteger(bytes, offset);
  const s = readInteger(bytes, r.next);

  // The host only accepts the canonical, lower half. Flipping s to n - s
  // yields an equally valid signature over the same message.
  const canonicalS = s.value > HALF_N ? N - s.value : s.value;

  const out = new Uint8Array(64);
  out.set(bigIntTo32Bytes(r.value), 0);
  out.set(bigIntTo32Bytes(canonicalS), 32);
  return out;
}

/**
 * Pull the raw secp256r1 point out of an SPKI-wrapped public key.
 *
 * `AuthenticatorAttestationResponse.getPublicKey()` returns SPKI DER. For
 * P-256 the key is the last 65 bytes, `0x04 ++ X ++ Y`, which is precisely
 * what the wallet contract stores and what `secp256r1_verify` expects. This
 * avoids decoding the CBOR attestation object altogether.
 *
 * @param {Uint8Array|ArrayBuffer} spki
 * @returns {Uint8Array} 65 bytes
 */
export function spkiToUncompressedPoint(spki) {
  const bytes = spki instanceof Uint8Array ? spki : new Uint8Array(spki);
  const point = bytes.subarray(bytes.length - 65);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('that credential is not an uncompressed P-256 key — is it RS256?');
  }
  return point;
}

export function toBase64Url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(view).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}
