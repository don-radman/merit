# What parts of Stellar does Merit use?

The answer to "so what did you actually use?", in plain words, with where it lives in the
repository and how anyone can check it. Written for a judge or someone from the Stellar team.
Everything here was verified on 26 October 2026 against the testnet deployment the Calder
portal reads; the verification log is at the end.

## In one breath

Merit uses Stellar's own accounts and assets for the fund and the money, a Soroban contract
of ours for the record of who introduced whom, Stellar's native passkey verification so an
investor signs with Face ID instead of a seed phrase, and OpenZeppelin's confidential token
on Stellar so the fee can be paid without its amount appearing on the public ledger.

## The parts, one by one

### 1. Stellar accounts and classic assets: the fund and the money

**Plain words.** The fund unit (CSDIF) and the test dollar (TUSDC) are ordinary Stellar
assets issued by the fund's own account. An investor holds units the way anyone holds an
asset on Stellar: in an account, after opening a trustline to it.

**Where.** `scripts/e2e-testnet.sh` and `scripts/seed-demo.sh` issue the two assets, open
trustlines and mint. The issuer is `GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ`.

**Why Stellar for this.** Classic assets carry the controls a regulated issuer needs,
authorization required, authorization revocable and clawback, as network features. We have
**not switched those flags on** for the testnet issuer (see README, "The compliance controls
are not switched on"). Turning them on is the first production step.

### 2. The Stellar Asset Contract: how a contract moves classic money

**Plain words.** A Soroban contract cannot touch a classic asset directly; it goes through
that asset's Stellar Asset Contract (SAC), a built-in bridge. When an investor subscribes,
our contract calls the TUSDC SAC to take the dollars and the CSDIF SAC to issue the units,
in one atomic transaction.

**Where.** `contracts/introducer-rails/src/lib.rs`, `subscribe`. The SACs on testnet are
`CAU2S7MLSMT3T3OLZLLAEOYXIQ63RIQ3D2CXZGU7BVSABYOBBECCP45I` (TUSDC) and
`CDUDSK7LJATIT4OULSY6PRETCGYY5VIUH35HKDVHNMN3XMRQJAOQWCKO` (CSDIF).

**Check.** The subscription transaction
`e107d7862bb6e8f673009f8bf86ca71d74675afd0179166012a0fc8f709f6121` (ledger 5384691,
successful) has both SACs in its footprint.

### 3. A Soroban smart contract: the record

**Plain words.** Our contract is the ledger of introductions. It knows a code, the investor,
the amount, and whether the fee has vested, been paid or been reversed. It holds no rate and
no fee; those stay off chain with the fund. Every state change publishes an event, so anyone
can audit the record without trusting our screens.

**Where.** `contracts/introducer-rails`. Functions: `initialise`, `register_introducer`,
`subscribe`, `claim`, `settle` (issuer only), `recover`, `get_book`, `get_ledger`,
`claimable_basis`. Deployed at `CDENXKDNNRLQ7F3C7VI3EWFPJBUMO5L6BDV2CZE6LSCP47G5JUGTPJT4`.
Ten host tests, all passing (`cargo test -p introducer-rails`).

**Check.** Register `245828ba…`, subscribe `e107d786…`, claim `d8eaa903…`, settle
`45b1b0d4…` (ledger 5385174), recover `d31ef150…`. All on the contract above; all successful.

### 4. Contract events: the audit trail

**Plain words.** `register`, `subscribe`, `claimed` and `recovered` are emitted on every
change. `claimed` publishes the ids that were settled, deliberately not a total, because a
total would hand an observer the settlement basis.

**Where.** `contracts/introducer-rails/src/lib.rs`; DECISIONS.md D11.

### 5. Native passkey verification: accounts without seed phrases

**Plain words.** Stellar can verify the kind of signature a phone's Face ID or fingerprint
produces (the P-256 curve used by WebAuthn) as a built-in host function. That lets an account
be a small contract whose "password" is the user's device. Nothing to install, nothing to
write down.

**Where.** `contracts/passkey-wallet`: `__check_auth` verifies a WebAuthn assertion with
`secp256r1_verify`. Thirteen host tests, all passing. A relayer account pays network fees and
deploys the account contracts; it holds no passkey and can authorise nothing, so it is not
custody (DECISIONS.md D13, D14).

**Check.** The Calder portal (`site/`) opens real passkey accounts on testnet. The video is
the only place the secure element itself is exercised; the tests cover the verification.

### 6. OpenZeppelin's confidential token: the private payout

**Plain words.** This is the new part, and an ecosystem part rather than a protocol part. A
confidential token keeps balances and transfer amounts encrypted on the ledger while the
sender and recipient stay visible. An auditor key can open them. We put the adviser's fee
on it, so the payout exists on a public network with no amount in it.

**Where.** `scripts/confidential.sh`, `scripts/conf-settle.mjs`, `src/lib/confidential.ts`.
Deployed on testnet from OpenZeppelin stellar-contracts v0.8.0: token
`CDHJYRAMWXJXNSSA36YIZFSMPWRBDN2KLLEY5KWLOS2P2JXKXIDSN3YX`, allowlist policy
`CAX3QU5ZIJG4KZSDJRRXGJDX2252DVMJ27673XYTNTTO334XJYP25ONS`, verifier
`CCXDZXDL6KHPB2EBTK7COJ2DFLCYOGE3B2IA5K4RCPW7UZ7DIT4EOTUW`, auditor registry
`CB45BGTIVC256HCUFHY2D42UI3XA2TG2HH3HUTIBZH56SNRWCSEZJWU4`.

**Check.** Confidential transfer `b32cd67addbcbb3a5a1f3b78212126ed5194ceb7411fd5251765308358b50e35`
(ledger 5383081, successful): the payload carries commitments and a 14,592-byte proof and no
amount. The pool top-up `b3f94e3e…` is the one event whose amount is public, by design. The
verifier accepting a proof: `b4e99c0c…`.

**The protocol underneath it.** The verifier is a contract that checks an UltraHonk proof
using Stellar's native BN254 host functions (`bn254_g1_add`, `bn254_g1_mul`,
`bn254_multi_pairing_check`, CAP-74), which is why a 14 KB proof can be verified on chain at
all. That is a core protocol feature, reached through OpenZeppelin's contracts.

**Honest limit.** Stellar's verifier accepts non-zero-knowledge UltraHonk proofs today, so
the amount is absent from the ledger and the events, but the proof itself carries no
privacy guarantee yet. Zero-knowledge verification is in progress at the network level.
Nothing in our design changes when it lands.

### 7. OpenZeppelin's policy library: who may hold the fee token

**Plain words.** An allowlist contract decides which accounts may receive the confidential
token. The fund lists an adviser once; the transfer checks the list.

**Check.** The allowlist checks appear in the confidential transfer's footprint (the
`Allowed` entries for sender and recipient).

### 8. Stellar RPC, Horizon and the explorer: how the screens read the chain

**Plain words.** The Calder portal reads the contract through Stellar RPC. The scripts use
Horizon and RPC. The guided demo links each beat to stellar.expert, where anyone can open the
transaction.

**Where.** `src/lib/live.ts`, `scripts/site-setup.mjs`, `src/lib/onchain.ts`.

### 9. Standards we point at but have not implemented

- **SEP-12** (KYC API) and **SEP-9** fields: the seam where a portal's identity checks
  would connect. Simulated in the demo; the portal owns it.
- **SEP-8** (regulated assets) and the asset flags: the "approval signal" Merit would wait
  for before recording a subscription. Off on testnet; production step one.
- **SEP-41** (token interface): what the confidential token wraps.

## Which track: Unlocked or Composed?

HackMeridian defines the Genesis tracks like this (hackmeridian.com/build, 26 Oct 2026):
*Stellar Unlocked*: "your project gets something new out of Stellar's core protocol
features". *Stellar Composed*: "your project combines two or more ecosystem tools or
projects into something new". A Genesis project can be in both. Track Alignment is 20% of
the score.

**Composed is the primary fit, and a strong one.** Merit is exactly a composition: OpenZeppelin's
confidential token plus its policy library, a passkey smart account, our own attribution
contract, and a fund's portal, combined into something none of them does alone. Two of the
track's own "ideas to get you started" describe our parts almost verbatim: "private payments
that hide amounts (Confidential Tokens, OpenZeppelin)" and "wallets people want to use: no
seed phrases, no gas, no jargon".

**Unlocked is a secondary fit.** We use core protocol features directly: classic asset
issuance with the SAC bridge, trustlines, contract events, the native P-256 verification
that makes passkeys possible, and, through OpenZeppelin's verifier, the BN254 host functions
the track page itself names under "ZK, natively". What would make the Unlocked claim strong is the thing we have
not done yet: switching on authorization required, revocable and clawback on the issuer and
using that approval as the gate Merit waits for. That is production step one, and it is worth
saying so.

**Recommendation.** Submit under both, as the rules allow, and lead the Track Alignment
answer with Composed. One sentence for the form: *Merit composes OpenZeppelin's confidential
token and policy library, a native passkey account and a Soroban attribution contract into a
distribution rail for tokenized funds, on Stellar's own assets and asset controls.*

How the rest of the rubric lands, for the submission answers:

| Criterion | Weight | What to point at |
|---|---|---|
| Track alignment | 20% | the composition above; the confidential transfer with no amount |
| User value and problem | 20% | advisers chase fees; funds reconcile by hand; terms must stay private |
| Technical execution | 15% | 23 contract tests, the testnet transactions, the portal reading live |
| Innovation | 15% | public record, private terms, on one network |
| Hackathon progress | 10% | the spike log in `contracts/SPIKE.md`: from "proofs not accepted" to settlement on chain in a day |
| Market and ecosystem | 10% | US$4B of tokenized assets on Stellar with no distribution rail; DTCC in 2027 |
| Design and UX | 10% | the investor flow in the fund's brand; the book; the guided demo |

## Verification log, 26 October 2026

| What | How | Result |
|---|---|---|
| Contract tests | `cargo test --workspace` | introducer-rails 10 passed, passkey-wallet 13 passed |
| Client stub | `npm run smoke` | 77 passed |
| Types | `npm run typecheck` | clean |
| Settle transaction | Horizon `/transactions/45b1b0d4…` | successful, ledger 5385174, issuer-signed |
| Confidential transfer | Horizon `/transactions/b32cd67a…` | successful, ledger 5383081, no amount in payload |
| Subscribe transaction | Horizon `/transactions/e107d786…` | successful, ledger 5384691, both SACs in footprint |
| Nameserver delegation | Google DNS, NS and A lookups | meritdue.com and demo.meritdue.com on Vercel's nameservers |
| Live site | HTTPS fetch from outside the sandbox | www.meritdue.com and demo.meritdue.com serve the build |
| End-to-end demo | Playwright over the built bundle | investor flow, book update, public view, vest, payout, reset, guide, phone widths |
