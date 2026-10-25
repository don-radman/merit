#![no_std]
//! A Soroban smart account whose only signer is a WebAuthn passkey.
//!
//! The investor in this system never holds a secret key. Their authority is a
//! credential that lives in the secure element of their phone or laptop —
//! Touch ID, Face ID, Windows Hello — and never leaves it. This contract is
//! the on-chain half of that: it holds the credential's public key and, every
//! time somebody calls `require_auth` on this account, the host hands it a
//! WebAuthn assertion to check.
//!
//! Why this matters for distribution: the alternative is a seed phrase, and a
//! seed phrase is a non-starter for the investor this product is aimed at.
//! Nobody is going to move six figures into a fund through a browser extension
//! that asks them to write twelve words on paper. A passkey is the only
//! credential model that a private-bank client already understands, because
//! they already unlock their banking app with it.
//!
//! What this contract deliberately does NOT contain: any token logic. The
//! account's address holds balances the same way any Stellar address does, and
//! a transfer is the SAC's own `transfer` with this account as `from`. That
//! call triggers `__check_auth` here. So the wallet needs no `send` function,
//! no allowlist of tokens, and no upgrade path when a new asset appears — it
//! is an authorizer, not a ledger.
//!
//! ## What is verified, and why each check is here
//!
//! A WebAuthn assertion is three pieces of data: `authenticatorData` (what the
//! device asserts), `clientDataJSON` (what the browser asserts) and a
//! secp256r1 signature over `sha256(authenticatorData ++ sha256(clientDataJSON))`.
//! Verifying the signature alone is not enough, and every additional check
//! below closes a specific hole:
//!
//! 1. **The credential is a registered signer.** Otherwise any passkey in the
//!    world authorizes this account.
//! 2. **`rpIdHash` matches the domain this wallet was created for.** The
//!    browser will only ever release an assertion to the credential's own
//!    origin, but this account must not take the browser's word for it: the
//!    device signs `rpIdHash`, so checking it on chain means a relayer cannot
//!    replay an assertion that was minted for some other site.
//! 3. **User presence and user verification flags are set.** UP means a human
//!    touched the device; UV means the device actually checked who they were
//!    (biometric or PIN) rather than merely noticing a tap. A wallet holding a
//!    fund position should not settle for a tap.
//! 4. **The ceremony is `webauthn.get`.** Without this, a registration
//!    ceremony's bytes could be replayed as an authorization.
//! 5. **The challenge in `clientDataJSON` is exactly this transaction's
//!    signature payload.** This is the binding that makes the whole thing an
//!    authorization of *this* call rather than a reusable token. The host
//!    derives the payload from the transaction's own contents, so an assertion
//!    for one transfer cannot move a different amount to a different address.
//! 6. **The signature verifies** against the stored public key.
//!
//! All six must hold. Any one of them failing means no authorization.

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    symbol_short, Bytes, BytesN, Env, Vec,
};

/// base64url, no padding — RFC 4648 §5. WebAuthn writes the challenge into
/// `clientDataJSON` in this alphabet, so the contract has to speak it to
/// compare a challenge against a payload it was given as raw bytes.
const B64URL: [u8; 64] = *b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// The JSON member the browser puts the challenge in.
const CHALLENGE_KEY: [u8; 13] = *b"\"challenge\":\"";

/// The ceremony type for an authorization. A `create` ceremony says
/// `webauthn.create`, and its bytes must never authorize a payment.
const CEREMONY_GET: [u8; 21] = *b"\"type\":\"webauthn.get\"";

/// A 32-byte payload is 43 base64url characters with no padding.
const CHALLENGE_LEN: u32 = 43;

/// `authenticatorData` layout: 32 bytes of rpIdHash, then one flags byte.
const FLAGS_OFFSET: u32 = 32;
/// User present — a human interacted with the authenticator.
const FLAG_UP: u8 = 0x01;
/// User verified — the authenticator checked a biometric or PIN.
const FLAG_UV: u8 = 0x04;
/// rpIdHash + flags + 4-byte signature counter.
const MIN_AUTHENTICATOR_DATA: u32 = 37;

/// One WebAuthn assertion, exactly as the browser produced it.
///
/// `authenticator_data` and `client_data_json` are passed verbatim and
/// unparsed, because the signature covers those exact bytes. Anything this
/// contract reconstructed itself — reserialized JSON, a re-encoded challenge —
/// would hash differently and fail, which is the correct outcome but a
/// confusing way to discover you have been clever.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Signature {
    /// Which registered credential signed. A wallet may hold several.
    pub credential_id: Bytes,
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    /// secp256r1 signature as raw `r ++ s`, 32 bytes each.
    ///
    /// WebAuthn hands the browser a DER-encoded signature and roughly half of
    /// all signatures come back in high-S form. The host requires low-S, so
    /// the client unwraps the DER and normalizes S before it gets here. This
    /// contract cannot do that for it: flipping S would change the bytes the
    /// device signed.
    pub signature: BytesN<64>,
}

#[contracttype]
pub enum DataKey {
    /// credential id -> uncompressed secp256r1 public key.
    Signer(Bytes),
    /// sha256 of the domain the wallet's credentials belong to.
    RpIdHash,
    /// How many signers are registered, so the last one cannot be removed.
    SignerCount,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The assertion names a credential this account does not know.
    UnknownSigner = 1,
    SignerExists = 2,
    /// Removing it would leave an account nobody can authorize.
    LastSigner = 3,
    /// `authenticatorData` is too short to contain its own header.
    MalformedAuthenticatorData = 4,
    /// No user presence, or no user verification.
    UserNotVerified = 5,
    /// The assertion was minted for a different domain.
    WrongOrigin = 6,
    /// A registration ceremony, or some other ceremony, not an authorization.
    WrongCeremony = 7,
    /// `clientDataJSON` has no challenge member.
    NoChallenge = 8,
    /// The challenge is not this transaction's signature payload.
    ChallengeMismatch = 9,
    NotInitialised = 10,
}

#[contract]
pub struct PasskeyWallet;

impl PasskeyWallet {
    fn rp_id_hash(env: &Env) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::RpIdHash)
            .ok_or(Error::NotInitialised)
    }

    fn signer_count(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0)
    }

    /// base64url-encode a 32-byte payload, unpadded — 43 characters.
    ///
    /// Written out rather than looped over a generic length because the only
    /// thing this contract ever encodes is a 32-byte signature payload, and
    /// 32 % 3 == 2 means the tail is always the same shape: ten full 3-byte
    /// groups, then two bytes into three characters.
    fn base64url_payload(env: &Env, payload: &BytesN<32>) -> Bytes {
        let raw = payload.to_array();
        let mut out = [0u8; CHALLENGE_LEN as usize];
        let mut i = 0usize;
        let mut o = 0usize;
        while i + 3 <= 32 {
            let n = ((raw[i] as u32) << 16) | ((raw[i + 1] as u32) << 8) | (raw[i + 2] as u32);
            out[o] = B64URL[((n >> 18) & 63) as usize];
            out[o + 1] = B64URL[((n >> 12) & 63) as usize];
            out[o + 2] = B64URL[((n >> 6) & 63) as usize];
            out[o + 3] = B64URL[(n & 63) as usize];
            i += 3;
            o += 4;
        }
        // Two bytes left over: 18 bits of input become three characters.
        let n = ((raw[30] as u32) << 16) | ((raw[31] as u32) << 8);
        out[40] = B64URL[((n >> 18) & 63) as usize];
        out[41] = B64URL[((n >> 12) & 63) as usize];
        out[42] = B64URL[((n >> 6) & 63) as usize];
        Bytes::from_array(env, &out)
    }

    /// Does `haystack` contain `needle` starting at `at`?
    fn matches_at(haystack: &Bytes, needle: &[u8], at: u32) -> bool {
        if at + (needle.len() as u32) > haystack.len() {
            return false;
        }
        let mut i = 0u32;
        while i < needle.len() as u32 {
            if haystack.get_unchecked(at + i) != needle[i as usize] {
                return false;
            }
            i += 1;
        }
        true
    }

    /// Index of the first occurrence of `needle`, scanning forward.
    ///
    /// Forward and first-match on purpose. `clientDataJSON` always opens with
    /// the `type` member, whose value the browser writes itself, so nothing an
    /// attacker controls can appear before the real challenge member. Taking a
    /// later match — or trusting an offset supplied by the caller — would let
    /// a decoy `"challenge":"..."` buried in a string field stand in for the
    /// real one.
    fn index_of(haystack: &Bytes, needle: &[u8]) -> Option<u32> {
        let len = haystack.len();
        let n = needle.len() as u32;
        if n == 0 || n > len {
            return None;
        }
        let mut at = 0u32;
        while at + n <= len {
            if Self::matches_at(haystack, needle, at) {
                return Some(at);
            }
            at += 1;
        }
        None
    }
}

#[contractimpl]
impl PasskeyWallet {
    /// Create the account around one credential.
    ///
    /// `rp_id_hash` is sha256 of the relying-party id — the bare domain, e.g.
    /// "localhost" or "invest.calderam.sg". It is fixed here and never
    /// changeable: a wallet that could be repointed at another domain is a
    /// wallet whose owner can be swapped by whoever controls that domain.
    pub fn __constructor(
        env: Env,
        rp_id_hash: BytesN<32>,
        credential_id: Bytes,
        public_key: BytesN<65>,
    ) {
        env.storage().instance().set(&DataKey::RpIdHash, &rp_id_hash);
        env.storage()
            .instance()
            .set(&DataKey::Signer(credential_id.clone()), &public_key);
        env.storage().instance().set(&DataKey::SignerCount, &1u32);
        env.events()
            .publish((symbol_short!("signer"), symbol_short!("added")), credential_id);
    }

    /// Register another passkey — a second device, or a replacement before the
    /// first one is lost.
    ///
    /// Authorized by the account itself, which means an existing passkey has
    /// to approve it. That is the whole recovery story in this build: add your
    /// laptop while you still have your phone. Social or guardian recovery is
    /// a real omission and is called out in DECISIONS.md.
    pub fn add_signer(
        env: Env,
        credential_id: Bytes,
        public_key: BytesN<65>,
    ) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        if env.storage().instance().has(&DataKey::Signer(credential_id.clone())) {
            return Err(Error::SignerExists);
        }
        env.storage()
            .instance()
            .set(&DataKey::Signer(credential_id.clone()), &public_key);
        env.storage()
            .instance()
            .set(&DataKey::SignerCount, &(Self::signer_count(&env) + 1));
        env.events()
            .publish((symbol_short!("signer"), symbol_short!("added")), credential_id);
        Ok(())
    }

    /// Revoke a passkey — a lost phone.
    pub fn remove_signer(env: Env, credential_id: Bytes) -> Result<(), Error> {
        env.current_contract_address().require_auth();
        if !env.storage().instance().has(&DataKey::Signer(credential_id.clone())) {
            return Err(Error::UnknownSigner);
        }
        // Refusing this is the difference between revoking a device and
        // destroying the account's contents permanently.
        if Self::signer_count(&env) <= 1 {
            return Err(Error::LastSigner);
        }
        env.storage().instance().remove(&DataKey::Signer(credential_id.clone()));
        env.storage()
            .instance()
            .set(&DataKey::SignerCount, &(Self::signer_count(&env) - 1));
        env.events()
            .publish((symbol_short!("signer"), symbol_short!("removed")), credential_id);
        Ok(())
    }

    pub fn has_signer(env: Env, credential_id: Bytes) -> bool {
        env.storage().instance().has(&DataKey::Signer(credential_id))
    }

    pub fn signers(env: Env) -> u32 {
        Self::signer_count(&env)
    }

    pub fn rp_id(env: Env) -> Result<BytesN<32>, Error> {
        Self::rp_id_hash(&env)
    }
}

#[contractimpl]
impl CustomAccountInterface for PasskeyWallet {
    type Signature = Signature;
    type Error = Error;

    /// Check a WebAuthn assertion against this account's registered passkeys.
    ///
    /// `auth_contexts` describes every call this assertion would authorize.
    /// This build accepts all of them: one touch authorizes the whole
    /// transaction, which is what the user was shown before they touched it.
    /// A per-context policy — this credential may only call the fund, that one
    /// may only move under $10,000 — is the obvious next thing to put here and
    /// is where a session-key model would live.
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: Signature,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let public_key: BytesN<65> = env
            .storage()
            .instance()
            .get(&DataKey::Signer(signature.credential_id.clone()))
            .ok_or(Error::UnknownSigner)?;

        let auth_data = &signature.authenticator_data;
        if auth_data.len() < MIN_AUTHENTICATOR_DATA {
            return Err(Error::MalformedAuthenticatorData);
        }

        // The device signed rpIdHash, so this is the check that survives a
        // malicious relayer: it cannot hand us an assertion minted elsewhere.
        let expected_rp = Self::rp_id_hash(&env)?;
        if auth_data.slice(0..FLAGS_OFFSET) != expected_rp.clone().into() {
            return Err(Error::WrongOrigin);
        }

        let flags = auth_data.get_unchecked(FLAGS_OFFSET);
        if flags & FLAG_UP == 0 || flags & FLAG_UV == 0 {
            return Err(Error::UserNotVerified);
        }

        let client_data = &signature.client_data_json;
        if Self::index_of(client_data, &CEREMONY_GET).is_none() {
            return Err(Error::WrongCeremony);
        }

        // The binding between this assertion and this transaction.
        let at = Self::index_of(client_data, &CHALLENGE_KEY).ok_or(Error::NoChallenge)?;
        let start = at + CHALLENGE_KEY.len() as u32;
        if start + CHALLENGE_LEN > client_data.len() {
            return Err(Error::NoChallenge);
        }
        let payload: BytesN<32> = signature_payload.into();
        let expected = Self::base64url_payload(&env, &payload);
        if client_data.slice(start..start + CHALLENGE_LEN) != expected {
            return Err(Error::ChallengeMismatch);
        }

        // WebAuthn signs sha256(authenticatorData ++ sha256(clientDataJSON)).
        let client_data_hash: BytesN<32> = env.crypto().sha256(client_data).into();
        let mut signed = auth_data.clone();
        signed.append(&client_data_hash.into());
        let digest = env.crypto().sha256(&signed);

        // Panics rather than returning false, which traps the whole
        // invocation. That is the right failure mode for an authorizer.
        env.crypto().secp256r1_verify(&public_key, &digest, &signature.signature);
        Ok(())
    }
}

mod test;
