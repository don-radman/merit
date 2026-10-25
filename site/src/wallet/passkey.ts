/**
 * The browser's whole job.
 *
 * Everything else — building transactions, talking to an RPC node, paying
 * fees — happens on the server. The one thing only the browser can do is ask
 * the secure element to sign, and that is all this module does.
 *
 * There is no key material here, in memory or in storage. What is kept in
 * localStorage is a credential id and a contract address, both public, both
 * recoverable by asking the authenticator again. Clearing it logs you out; it
 * does not lose you anything.
 */
import {
  derToCompactSignature,
  fromBase64Url,
  spkiToUncompressedPoint,
  toBase64Url,
} from './webauthn-sig.mjs';

export interface Assertion {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}

export interface AuthorizeSummary {
  title: string;
  lines: [string, string][];
  caution?: string;
}

const STORE_KEY = 'calder.device';

interface StoredDevice {
  credentialId: string;
  address: string;
  label: string;
}

export function rememberDevice(device: StoredDevice): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(device));
  } catch {
    // Private browsing. The session cookie still works for this tab; the only
    // thing lost is being able to name the right credential in
    // allowCredentials, and the authenticator will simply ask instead.
  }
}

export function storedDevice(): StoredDevice | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredDevice) : null;
  } catch {
    return null;
  }
}

export function forgetDevice(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing to clean up */
  }
}

/** Does this browser have a platform authenticator at all? */
export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator.credentials?.create === 'function'
  );
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  const check = (window.PublicKeyCredential as unknown as {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  }).isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof check !== 'function') return false;
  try {
    return await check.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

function randomChallenge(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export class PasskeyError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

/**
 * Create a passkey, and return the public key the wallet contract will store.
 *
 * `alg: -7` and nothing else: ES256, i.e. secp256r1, because that is the
 * curve Soroban can verify natively. An authenticator that offers only RS256
 * is refused here rather than producing a wallet that can never authorize
 * anything.
 *
 * `residentKey: 'required'` makes the credential discoverable, which is what
 * lets signing in work with no username, no stored identifier and no user
 * table on the server — the authenticator volunteers which account it holds.
 *
 * What this does NOT do is verify an attestation statement, so the server
 * takes the browser's word for the public key. That is only a risk to the
 * person doing it — they would be creating a wallet owned by a key they do
 * not hold — but a production deployment that cared which devices were
 * permitted would verify attestation here.
 */
export async function createPasskey(
  rpId: string,
  rpName: string,
  person: { name: string; displayName: string },
): Promise<{ credentialId: string; publicKey: string }> {
  if (!passkeysSupported()) {
    throw new PasskeyError('This browser does not support passkeys.');
  }

  const userId = new Uint8Array(32);
  crypto.getRandomValues(userId);

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { id: rpId, name: rpName },
        user: { id: userId, name: person.name, displayName: person.displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
        attestation: 'none',
        timeout: 90_000,
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw new PasskeyError(describeWebAuthnError(error), error);
  }
  if (!credential) throw new PasskeyError('No passkey was created.');

  const response = credential.response as AuthenticatorAttestationResponse;
  if (typeof response.getPublicKey !== 'function') {
    throw new PasskeyError('This browser cannot expose the credential public key.');
  }
  const spki = response.getPublicKey();
  if (!spki) throw new PasskeyError('The authenticator returned no public key.');

  return {
    credentialId: toBase64Url(new Uint8Array(credential.rawId)),
    publicKey: toBase64Url(spkiToUncompressedPoint(spki)),
  };
}

/**
 * Ask the secure element to sign one 32-byte Soroban authorization payload.
 *
 * `userVerification: 'required'` because the wallet contract insists on the
 * UV flag — a tap is not enough to move a fund position.
 */
export async function sign(
  challenge: string,
  rpId: string,
  allowCredentialId?: string,
): Promise<Assertion> {
  if (!passkeysSupported()) {
    throw new PasskeyError('This browser does not support passkeys.');
  }

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: {
        challenge: fromBase64Url(challenge),
        rpId,
        userVerification: 'required',
        timeout: 90_000,
        allowCredentials: allowCredentialId
          ? [{ type: 'public-key', id: fromBase64Url(allowCredentialId) }]
          : [],
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw new PasskeyError(describeWebAuthnError(error), error);
  }
  if (!credential) throw new PasskeyError('Nothing was signed.');

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    credentialId: toBase64Url(new Uint8Array(credential.rawId)),
    authenticatorData: toBase64Url(new Uint8Array(response.authenticatorData)),
    clientDataJSON: toBase64Url(new Uint8Array(response.clientDataJSON)),
    // DER in, 64 canonical bytes out. Without the low-S normalization inside
    // this call, about half of all signatures would be rejected by the host.
    signature: toBase64Url(derToCompactSignature(new Uint8Array(response.signature))),
  };
}

function describeWebAuthnError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
      return 'Cancelled, or the request timed out.';
    case 'InvalidStateError':
      return 'This device already holds a passkey for Calder. Try signing in instead.';
    case 'NotSupportedError':
      return 'This device cannot create the kind of passkey Calder needs (ES256).';
    case 'SecurityError':
      return 'Passkeys need a secure page. Use localhost or HTTPS.';
    default:
      return (error as { message?: string })?.message ?? 'The passkey request failed.';
  }
}

// ---------------------------------------------------------------------------
// Talking to the site
// ---------------------------------------------------------------------------

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new PasskeyError(payload.error ?? `Request failed (${response.status})`);
  return payload as T;
}

export interface PreparedAuthorization {
  requestId: string;
  challenge: string;
  summary: AuthorizeSummary;
  validUntilLedger: number;
}

export const prepareAuthorization = (intent: unknown) =>
  post<PreparedAuthorization>('/api/tx/prepare', { intent });

export const submitAuthorization = (requestId: string, assertion: Assertion) =>
  post<{ hash: string; summary: AuthorizeSummary; balances: unknown }>('/api/tx/submit', {
    requestId,
    assertion,
  });

export const openAccount = (credentialId: string, publicKey: string, code?: string | null) =>
  post<{ address: string; hash: string | null; alreadyExisted: boolean }>('/api/wallet/open', {
    credentialId,
    publicKey,
    code,
  });

export const signIn = (credentialId: string) =>
  post<{ address: string }>('/api/session', { credentialId });

export const signOut = () => post<{ ok: true }>('/api/session/clear');

export const credit = (amount: string) => post<{ hash: string }>('/api/credit', { amount });

/**
 * One complete authorization: prepare, touch, submit.
 *
 * `onSummary` fires between building the transaction and asking for the
 * fingerprint, so the screen can show what is about to be approved. A passkey
 * prompt itself says nothing about amounts or destinations — whatever the
 * investor understands about what they are signing, they understand from that
 * screen.
 */
export async function authorize(
  intent: unknown,
  rpId: string,
  options: { credentialId?: string; onSummary?: (summary: AuthorizeSummary) => void } = {},
): Promise<{ hash: string; summary: AuthorizeSummary }> {
  const prepared = await prepareAuthorization(intent);
  options.onSummary?.(prepared.summary);
  const assertion = await sign(prepared.challenge, rpId, options.credentialId);
  const result = await submitAuthorization(prepared.requestId, assertion);
  return { hash: result.hash, summary: prepared.summary };
}
