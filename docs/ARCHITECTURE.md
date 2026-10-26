# Merit — architecture, positioning and the questions a judge will ask

The one-page version of what Merit is made of, where its pieces sit, and what we claim.
Written for the pitch: every sentence here is something we can say out loud and point to.

## In one paragraph

Tokenized funds on Stellar are live and growing. The capital still reaches them the way it
always has: an adviser, a family office or a placement partner brings a qualified investor,
and the fee for that introduction is tracked by hand and paid on trust. Merit records the
introduction on the network the moment the client invests, vests the fee for the fund's
window, pays it in a transfer whose amount is hidden, and keeps every adviser's rate between
that adviser and the fund. Merit Connect is how that record plugs into the access portal a
manager already runs.

## The layers

Bottom to top. The owner column is who maintains the layer; Merit is deliberately thin.

| Layer | Owner | What it does | Why it is there |
|---|---|---|---|
| Stellar network | Stellar | Settlement in about five seconds for fractions of a cent. Asset-level controls: authorization required, freeze, clawback. | The controls a regulated issuer needs are network features, not middleware. |
| Classic fund asset + Stellar Asset Contract | Fund (issuer) | The fund unit as a Stellar asset, callable from contracts through its SAC. | Institutional issuers on Stellar (BENJI, Spiko, Ondo) use the same primitive. |
| Passkey smart account | Merit (`contracts/passkey-wallet`) on Stellar's `secp256r1` host function | An account whose signature is a WebAuthn assertion: Face ID, fingerprint or device PIN. 13 host tests. | No seed phrase. The investor signs with the device they already own. |
| Relayer | Merit | A plain account that pays network fees and deploys accounts. Holds no passkey, so it can authorise nothing. | The investor never buys XLM. Not custody. |
| OpenZeppelin confidential token (`stellar-confidential`, stellar-contracts v0.8.0) | OpenZeppelin | A token whose balances and transfer amounts are encrypted; sender and recipient stay public; an auditor key can decrypt. | A private fee on a public network. New on Stellar in 2026. |
| Merit attribution contract | Merit (`contracts/`) | `subscribe`, `claim`, `settle` (issuer only), `recover`, `get_book`, `get_ledger`. Records code → investor → amount and the vesting state. Emits an event on every state change. **Stores no rate and no fee.** | The record nobody can deny. The settlement basis without the settlement terms. |
| Merit surfaces | Merit (`src/`) | The adviser's book, the fund's attribution ledger and payout run, the investor flow in the client's brand. | One set of words and statuses across every fund. |
| Merit Connect | Merit + the partner | The integration layer: resolve a code, attach an introduction to a subscription, read a book, run a payout; plus the service of fitting it into the partner's portal. | The fund keeps its portal, its KYC and its custody. Merit is added, not substituted. |

The frozen client interface in `src/lib/types.ts` is the Merit Connect surface in embryo: it
is the only thing the screens talk to, and it is what a partner portal would call.

## Where the data lives

| | Public (on the network) | Private |
|---|---|---|
| Who introduced whom | yes, by code and account | |
| How much was invested | yes | |
| Whether the fee has vested, been paid or been reversed | yes, as events | |
| The adviser's rate | | in the fund's own systems; never on chain |
| The adviser's fee | | computed off chain at that rate; paid as a confidential transfer whose amount is hidden |
| The fund's distribution pool top-up | yes, as an aggregate deposit | |
| Investor identity | | in the portal's KYC; the chain holds an account, not a name |

The line that matters commercially: **fund flows get disclosed, distribution terms do not.**
A manager will publish what came in. It will not let one distributor learn another's rate.

## Why the confidential token is the important new part

Without it, a private fee on a public network needs one of two bad answers: pay off chain and
lose the record, or pay on chain and publish every adviser's income. The confidential token
removes the trade-off. The introduction stays public and undeniable; the payout amount is
absent from the ledger entry and from the event; the fund and its auditor can still
reconcile the total through the auditor key.

Honest limit, to say before asked: the Stellar verifier today accepts non-zero-knowledge
UltraHonk proofs, so the proof itself carries no privacy guarantee yet. Zero-knowledge
verification is in progress at the network level. Amounts are already absent from the
ledger and events. Fine for a testnet demonstration of a fictional fund; not something we
would ship for real money until the verifier lands.

## The four flows, and who signs

1. **Subscribe.** The investor, with a passkey, through the fund's portal. The contract
   records the attribution and the amount; the fund issues units. Emits `subscribe`.
2. **Vest.** Nothing to sign. The window is an `initialise` argument: 300 seconds on the demo
   deployment, 90 days in production.
3. **Settle.** The issuer, in one payout run. `settle` marks the vested rows and emits the
   ids (not a total, which would hand an observer the settlement basis). The payment is a
   confidential transfer per adviser from the fund's pool.
4. **Recover.** The issuer, if the investor exits inside the window. Flips the row to
   reversed and emits `recovered`. Refused once the row has vested.

## Merit Connect: the seam

What a partner portal has to do, and what it does not.

- **Does:** render the adviser's link, call Merit when the subscription completes, and tell
  Merit when the investor's account has been approved.
- **Does not:** send Merit any identity data, change its KYC provider, change its custody,
  or change how it issues units.
- **The approval signal.** On a classic asset it is the issuer authorising the trustline
  (`AUTH_REQUIRED`). On a contract token it is an allowlist entry. Merit treats that as the
  precondition for a subscription and otherwise stays out of the way.
- **KYC stays with the regulated party.** Stellar's own standard for this is SEP-12 (with
  SEP-9 fields and SEP-10 authentication); reusable-KYC providers exist in the ecosystem
  (idOS is live). A portal keeps whichever it uses. In the demo the "Check my details" stage
  is simulated on purpose.

## Why Stellar, why now

- US$4B of tokenized real-world assets and 67 tokenized products on Stellar; Franklin
  Templeton's BENJI (US$605M), Spiko (US$1.7B), Ondo's USDY (US$500M+). DTCC's tokenization
  service connects to Stellar in the first half of 2027. (stellar.org, October 2026.)
- The asset controls institutions ask for are network features.
- Passkey verification is a host function, so the no-seed-phrase account is cheap and native.
- OpenZeppelin's confidential token arrived this year. It is the missing piece for a
  distribution layer: the record can be public and the terms private.
- The distribution rail is the gap. Every one of those products still gets its capital
  through introductions tracked by hand.

## What we claim and what we do not

Say these before being asked.

- Attribution, vesting and recovery are on chain, on the deployed testnet contract, and the
  Calder portal reads it live.
- The passkey account is real: the network verifies the WebAuthn assertion.
- No rate is on chain. The demo rates in `src/lib/fixtures.ts` are demo data for a fictional
  fund; the claim is about the chain.
- Confidential settlement is real but was run by a script against a separate deployment from
  the one the portal reads. Two proofs, not one pipeline.
- The compliance flags on the testnet issuer are off; the "approving your account" stage is
  presentational today.
- It is a placement fee, settled once on the subscription basis, not a trail.
- The hosted click-through demo runs on sample data. The live flow runs on the Calder portal.

## Ten questions, ten answers

1. **Why not a spreadsheet and a bank transfer?** Because the adviser has to trust the
   manager wrote it down, and the manager has to reconcile it by hand. Merit makes the record
   undeniable and the payout automatic, and it costs cents.
2. **Why does the fee need to be private?** A fund will not let one distributor see
   another's terms, and an adviser will not use a system that publishes their income.
3. **Why a public network at all, then?** Because the introduction has to be undeniable by
   either side. Public record, private terms.
4. **What does the chain actually show?** Who introduced whom, how much was invested, and the
   status. Not the rate, not the fee.
5. **Is the amount really hidden?** It is absent from the ledger entry and the event. The
   proof system is not yet zero-knowledge on Stellar; that is in progress, and it is why this
   is a testnet demonstration.
6. **Who does KYC?** The fund or its portal, as today. Merit never sees it; it waits for the
   approval.
7. **What does a fund have to change to use it?** Add a link and two calls to its portal.
   Nothing about custody, onboarding or issuance.
8. **What stops a dispute?** Every state change is an event anyone can read. Reversal is in
   the contract and refused after vesting.
9. **Why Stellar rather than another chain?** The tokenized funds are here, the asset
   controls are native, passkeys are a host function, and the confidential token exists.
10. **What is Merit's business?** Software for the fund (the ledger and payout run) and a
    platform-level integration, Merit Connect, with Co/Unity running the programme around it.
