#![cfg(test)]
extern crate std;

use super::*;
use p256::ecdsa::{signature::Signer as _, Signature as EcdsaSignature, SigningKey};
use sha2::{Digest, Sha256};
use soroban_sdk::{vec, Address, Bytes, BytesN, Env, IntoVal, InvokeError};
use std::string::String as StdString;
use std::vec::Vec as StdVec;

const CRED: &[u8] = b"calder-passkey-credential-id";
const RP_ID: &str = "invest.calderam.sg";

/// Stands in for the secure element. Everything it produces is byte-identical
/// in shape to what a browser hands back from `navigator.credentials.get()`,
/// so a test that passes here is testing the real payload and not a
/// convenient approximation of it.
struct Authenticator {
    key: SigningKey,
    rp_id_hash: [u8; 32],
}

fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().into()
}

/// The same encoding the contract implements, written independently here so a
/// bug in one is not mirrored in the other.
fn b64url(raw: &[u8]) -> StdString {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = StdString::new();
    for chunk in raw.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        let chars = [
            A[((n >> 18) & 63) as usize],
            A[((n >> 12) & 63) as usize],
            A[((n >> 6) & 63) as usize],
            A[(n & 63) as usize],
        ];
        for c in chars.iter().take(chunk.len() + 1) {
            out.push(*c as char);
        }
    }
    out
}

impl Authenticator {
    fn new(rp_id: &str) -> Self {
        // Fixed key so a failure is reproducible rather than a one-in-N flake.
        let key = SigningKey::from_bytes(&[0x2au8; 32].into()).expect("valid scalar");
        Self { key, rp_id_hash: sha256(rp_id.as_bytes()) }
    }

    /// Uncompressed SEC1 point, which is what `secp256r1_verify` wants and
    /// what a browser's `getPublicKey()` yields after the SPKI wrapper is
    /// stripped.
    fn public_key(&self, env: &Env) -> BytesN<65> {
        let point = self.key.verifying_key().to_encoded_point(false);
        let mut raw = [0u8; 65];
        raw.copy_from_slice(point.as_bytes());
        BytesN::from_array(env, &raw)
    }

    fn authenticator_data(&self, flags: u8) -> StdVec<u8> {
        let mut d = StdVec::new();
        d.extend_from_slice(&self.rp_id_hash);
        d.push(flags);
        d.extend_from_slice(&[0, 0, 0, 7]); // signature counter
        d
    }

    fn client_data(ceremony: &str, challenge: &str, origin: &str) -> StdString {
        // Member order matches what Chrome emits: type first, challenge
        // second. The contract scans forward for the challenge and relies on
        // nothing attacker-controlled preceding it.
        std::format!(
            "{{\"type\":\"{}\",\"challenge\":\"{}\",\"origin\":\"{}\",\"crossOrigin\":false}}",
            ceremony, challenge, origin
        )
    }

    /// Signs sha256(authenticatorData ++ sha256(clientDataJSON)), normalized
    /// to low-S because the host rejects the high-S half of every signature.
    fn sign(&self, env: &Env, auth_data: &[u8], client_data: &str) -> BytesN<64> {
        let mut signed = StdVec::new();
        signed.extend_from_slice(auth_data);
        signed.extend_from_slice(&sha256(client_data.as_bytes()));
        let sig: EcdsaSignature = self.key.sign(&signed);
        let sig = sig.normalize_s().unwrap_or(sig);
        let mut raw = [0u8; 64];
        raw.copy_from_slice(&sig.to_bytes());
        BytesN::from_array(env, &raw)
    }
}

struct Fixture {
    env: Env,
    client: PasskeyWalletClient<'static>,
    auth: Authenticator,
    address: Address,
}

/// What the host returns when it calls a custom account's `__check_auth`.
type AuthResult = Result<(), Result<Error, InvokeError>>;

impl Fixture {
    /// Ask the account to authorize `payload`, exactly as the host does when
    /// something calls `require_auth` on this address. `__check_auth` is not
    /// on the generated client — it is a host entry point, not a public
    /// method — so this is the only honest way to reach it.
    fn check(&self, payload: &BytesN<32>, sig: &Signature) -> AuthResult {
        self.env.try_invoke_contract_check_auth::<Error>(
            &self.address,
            payload,
            sig.clone().into_val(&self.env),
            &vec![&self.env],
        )
    }
}

fn setup() -> Fixture {
    let env = Env::default();
    let auth = Authenticator::new(RP_ID);
    let address = env.register(
        PasskeyWallet,
        (
            BytesN::from_array(&env, &auth.rp_id_hash),
            Bytes::from_slice(&env, CRED),
            auth.public_key(&env),
        ),
    );
    let client = PasskeyWalletClient::new(&env, &address);
    Fixture { env, client, auth, address }
}

/// One complete, valid assertion over `payload`.
fn assertion(f: &Fixture, payload: &BytesN<32>) -> Signature {
    let auth_data = f.auth.authenticator_data(FLAG_UP | FLAG_UV);
    let client_data = Authenticator::client_data(
        "webauthn.get",
        &b64url(&payload.to_array()),
        "https://invest.calderam.sg",
    );
    Signature {
        credential_id: Bytes::from_slice(&f.env, CRED),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data_json: Bytes::from_slice(&f.env, client_data.as_bytes()),
        signature: f.auth.sign(&f.env, &auth_data, &client_data),
    }
}

fn payload(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn a_passkey_assertion_authorizes_the_account() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let sig = assertion(&f, &p);
    assert_eq!(
        f.check(&p, &sig),
        Ok(()),
        "a well-formed assertion over this payload should authorize"
    );
    assert_eq!(f.client.signers(), 1);
    assert!(f.client.has_signer(&Bytes::from_slice(&f.env, CRED)));
}

#[test]
fn an_unregistered_credential_is_refused() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let mut sig = assertion(&f, &p);
    sig.credential_id = Bytes::from_slice(&f.env, b"someone-elses-passkey");
    assert_eq!(
        f.check(&p, &sig),
        Err(Ok(Error::UnknownSigner))
    );
}

#[test]
fn an_assertion_minted_for_another_domain_is_refused() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    // A valid assertion in every respect, signed by the right key — but the
    // device asserted a different rpIdHash, so it was never for this wallet.
    let other = Authenticator { key: f.auth.key.clone(), rp_id_hash: sha256(b"evil.example") };
    let auth_data = other.authenticator_data(FLAG_UP | FLAG_UV);
    let client_data =
        Authenticator::client_data("webauthn.get", &b64url(&p.to_array()), "https://evil.example");
    let sig = Signature {
        credential_id: Bytes::from_slice(&f.env, CRED),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data_json: Bytes::from_slice(&f.env, client_data.as_bytes()),
        signature: other.sign(&f.env, &auth_data, &client_data),
    };
    assert_eq!(
        f.check(&p, &sig),
        Err(Ok(Error::WrongOrigin))
    );
}

#[test]
fn a_tap_without_user_verification_is_refused() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let auth_data = f.auth.authenticator_data(FLAG_UP); // present, not verified
    let client_data = Authenticator::client_data(
        "webauthn.get",
        &b64url(&p.to_array()),
        "https://invest.calderam.sg",
    );
    let sig = Signature {
        credential_id: Bytes::from_slice(&f.env, CRED),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data_json: Bytes::from_slice(&f.env, client_data.as_bytes()),
        signature: f.auth.sign(&f.env, &auth_data, &client_data),
    };
    assert_eq!(
        f.check(&p, &sig),
        Err(Ok(Error::UserNotVerified)),
        "a wallet holding a fund position should require more than a tap"
    );
}

#[test]
fn a_registration_ceremony_cannot_authorize_a_payment() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let auth_data = f.auth.authenticator_data(FLAG_UP | FLAG_UV);
    let client_data = Authenticator::client_data(
        "webauthn.create",
        &b64url(&p.to_array()),
        "https://invest.calderam.sg",
    );
    let sig = Signature {
        credential_id: Bytes::from_slice(&f.env, CRED),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data_json: Bytes::from_slice(&f.env, client_data.as_bytes()),
        signature: f.auth.sign(&f.env, &auth_data, &client_data),
    };
    assert_eq!(
        f.check(&p, &sig),
        Err(Ok(Error::WrongCeremony))
    );
}

#[test]
fn an_assertion_for_a_different_transaction_is_refused() {
    let f = setup();
    // Signed correctly, over a real challenge — just not THIS transaction's.
    let sig = assertion(&f, &payload(&f.env, 0x41));
    assert_eq!(
        f.check(&payload(&f.env, 0x42), &sig),
        Err(Ok(Error::ChallengeMismatch)),
        "this is the binding that stops an assertion being a reusable token"
    );
}

#[test]
fn a_decoy_challenge_cannot_stand_in_for_the_real_one() {
    let f = setup();
    let wanted = payload(&f.env, 0x42); // what an attacker wants authorized
    let real = payload(&f.env, 0x41); // what the user was actually asked to sign
    let auth_data = f.auth.authenticator_data(FLAG_UP | FLAG_UV);
    // The decoy is buried in a later field, where a contract that trusted a
    // caller-supplied offset, or took the last match, would find it.
    let client_data = std::format!(
        "{{\"type\":\"webauthn.get\",\"challenge\":\"{}\",\"origin\":\"https://invest.calderam.sg/\\\"challenge\\\":\\\"{}\\\"\"}}",
        b64url(&real.to_array()),
        b64url(&wanted.to_array()),
    );
    let sig = Signature {
        credential_id: Bytes::from_slice(&f.env, CRED),
        authenticator_data: Bytes::from_slice(&f.env, &auth_data),
        client_data_json: Bytes::from_slice(&f.env, client_data.as_bytes()),
        signature: f.auth.sign(&f.env, &auth_data, &client_data),
    };
    assert_eq!(
        f.check(&wanted, &sig),
        Err(Ok(Error::ChallengeMismatch)),
        "the first match is the real challenge member"
    );
    // And the same bytes still authorize what the user did agree to.
    assert_eq!(f.check(&real, &sig), Ok(()));
}

#[test]
fn truncated_authenticator_data_is_refused() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let mut sig = assertion(&f, &p);
    sig.authenticator_data = Bytes::from_slice(&f.env, &[0u8; 20]);
    assert_eq!(
        f.check(&p, &sig),
        Err(Ok(Error::MalformedAuthenticatorData))
    );
}

#[test]
fn a_forged_signature_traps() {
    let f = setup();
    let p = payload(&f.env, 0x41);
    let mut sig = assertion(&f, &p);
    // Every framing check passes; only the signature is wrong. The host traps
    // rather than returning a value, which is the right failure mode for an
    // authorizer — there is no "partly authorized".
    sig.signature = BytesN::from_array(&f.env, &[0u8; 64]);
    // Abort, not a contract error: the host trapped inside secp256r1_verify.
    // Worth pinning, because it is the one rejection that cannot be confused
    // with a policy decision of this contract's own — a forged signature
    // never comes back as Err(Ok(Error::..)) and so can never be caught and
    // treated as "declined but fine".
    assert_eq!(f.check(&p, &sig), Err(Err(InvokeError::Abort)));
}

#[test]
fn a_second_passkey_can_be_added_and_the_first_revoked() {
    let f = setup();
    f.env.mock_all_auths();
    let laptop = Bytes::from_slice(&f.env, b"calder-passkey-laptop");
    let second = Authenticator::new(RP_ID);

    f.client.add_signer(&laptop, &second.public_key(&f.env));
    assert_eq!(f.client.signers(), 2);
    assert_eq!(
        f.client.try_add_signer(&laptop, &second.public_key(&f.env)),
        Err(Ok(Error::SignerExists))
    );

    // Losing the phone: revoke it, and the laptop still works.
    f.client.remove_signer(&Bytes::from_slice(&f.env, CRED));
    assert_eq!(f.client.signers(), 1);
    assert!(!f.client.has_signer(&Bytes::from_slice(&f.env, CRED)));
    assert!(f.client.has_signer(&laptop));
}

#[test]
fn the_last_passkey_cannot_be_revoked() {
    let f = setup();
    f.env.mock_all_auths();
    assert_eq!(
        f.client.try_remove_signer(&Bytes::from_slice(&f.env, CRED)),
        Err(Ok(Error::LastSigner)),
        "revoking it would not revoke a device, it would destroy the account"
    );
    assert_eq!(
        f.client.try_remove_signer(&Bytes::from_slice(&f.env, b"never-registered")),
        Err(Ok(Error::UnknownSigner))
    );
}

#[test]
fn the_wallet_reports_the_domain_it_was_created_for() {
    let f = setup();
    assert_eq!(f.client.rp_id(), BytesN::from_array(&f.env, &sha256(RP_ID.as_bytes())));
    // Not settable after construction: a wallet that could be repointed at
    // another domain is a wallet whose owner can be swapped.
}

#[test]
fn the_contract_and_the_test_agree_on_base64url() {
    // Both encoders are written out independently; this is the only place
    // they are compared. A 32-byte payload is always 43 unpadded characters.
    let env = Env::default();
    for seed in [0u8, 1, 0x3f, 0x40, 0xfe, 0xff] {
        let p = payload(&env, seed);
        let expected: Bytes = Bytes::from_slice(&env, b64url(&p.to_array()).as_bytes());
        let got = PasskeyWallet::base64url_payload(&env, &p);
        assert_eq!(got, expected, "seed {}", seed);
        assert_eq!(got.len(), 43);
    }
}
