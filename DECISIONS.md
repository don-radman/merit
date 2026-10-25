# Decision log

Hour 0 decisions, with reasoning. Kept because the judging criteria reward visible human
ownership, and because a decision whose reason is written down is a decision we will not
relitigate at 3am.

---

### D1 — Confidential **fees**, not confidential holdings
*Hour 0. Decided before writing code.*

Two places could hide numbers: introducer fee balances, or investor holdings. We hide fees.

The Stellar privacy docs state that the current verifier accepts only non-zero-knowledge
UltraHonk proofs, so OpenZeppelin does not guarantee that proofs keep balances and amounts
private; ZK verification is in progress and the docs say to read the ZK setting notes
before using confidential tokens with real assets.

A fictional fund on testnet is exactly the context where that caveat is acceptable.
Investor positions are not, even in a demo, because the demo is the pitch for the real
thing. Fees-only also keeps the fund unit as a plain classic asset, so the issuer keeps
`AUTH_REQUIRED`, freeze and clawback without us reconciling two mechanisms in 28 hours.

**Revisit when:** ZK verification ships.

---

### D2 — Fund units are a classic asset via SAC, not a custom contract token
*Hour 0.*

The regulated-asset controls (trustline authorization, freeze, clawback) are the thing
institutions ask for first and they come free with a classic asset. Issuance is also the
most well-trodden path in the ecosystem — `stellar-rwa-web` already demonstrates it — so
there is nothing to prove there and no reason to spend hours on it.

---

### D3 — Exactly three screens
*Hour 0.*

Investor subscribe, introducer book, issuer ledger. The judging advice was explicit that
one or two core features that work beat ten that half work, and that UX counts for nearly
as much as execution. Three screens is also the scope that lets the UI be built against a
stub while the contracts are still being written.

A fourth screen was considered and rejected: an asset-passport / plain-English explainer
page. It folds into the investor statement instead.

---

### D4 — A frozen client interface at hour 0, with a stub behind it
*Hour 0.*

Two people, 28 hours, one of them working through an agent. The failure mode is the
frontend idling until the contracts exist and then both of us integrating at 3am. So the
function signatures in `src/lib/types.ts` are frozen first and a stub implements them
immediately. The UI is built against the stub from hour 2; the contracts are swapped in
underneath as they land, one method at a time.

The interface is also the agent's spec. An agent given `types.ts` and the three-screen
section of the README does not invent a settings page.

---

### D5 — Anything touching a key, a signature or a ciphertext lives behind the client
*Hour 0.*

Passkey creation and signing, view-key decryption, transaction assembly and confirmation
waiting are all inside `src/lib/`. The UI never sees a keypair, never builds a transaction
and never handles a ciphertext. This is a correctness boundary, not a style preference:
those are the three places where code that looks right fails silently.

---

### D6 — The stub simulates the proof wait, and it can be made to fail
*Hour 0.*

Proof generation is a real, visible wait (see `PROVING_DELAY_MS`), and in-browser proving
is why the OZ demo ships a WASM prover. If the UI is built against an instant stub, the
spinner gets invented at hour 25 and the demo video has a dead ten seconds in it.

`setStubFailure()` exists for the same reason in the other direction: declined passkey,
rejected transaction and failed proof generation are states the screens must have, and an
agent building against a happy-path stub will not build them.

---

### D7 — Client names stay anonymous until permission comes back
*Hour 0.*

The problem statement is the strongest part of this submission and it comes from two real
calls. Both clients have agreed to be cited **anonymously**, so they appear throughout as
"a Singapore-based tokenized fund-of-funds manager" and "an RWA vault issuer". Neither is
named, and no commercial terms from either relationship appear anywhere in this repo, the
README, the deck or the video.

**Settled.** Do not add identifying detail later for colour.

---

### D8 — No monorepo tooling. Two toolchains, one repo, directory ownership.
*Hour 0. Considered Turborepo and npm workspaces; rejected both for this weekend.*

The thing we actually want is for two people to stop colliding on files. That is solved by
deciding who owns which directory and freezing the interface between them — which is done —
not by adding a build orchestrator.

Turborepo would not help here anyway. The contracts are Rust compiled to wasm, so they live
in a **cargo** workspace; Turbo orchestrates npm packages and has nothing useful to say about
`cargo build`. That leaves one JavaScript project, and Turbo's value over a single
`package.json` at that size is a cache we will not fill in 28 hours and a config file we
would debug instead of building.

Promoting `src/lib` to its own npm package was also considered and rejected: it adds a build
step and a version bump between the two people who most need to move fast, to enforce a
boundary that a frozen `types.ts` and a lint rule already enforce.

**Revisit when** any of these is true — all of them are post-hackathon:
- the issuer portal and the investor app deploy separately
- there is a shared design system used by more than one app
- CI is slow enough that remote caching pays for itself

The one structural thing we did take: **generated TypeScript bindings are committed**, so the
UI builds on a machine with no Rust toolchain.

---

### D9 — Fees vest. The issuer can recover them before they do.
*Added mid-build, after an insurance tangent turned out to be the same mechanic.*

A fee now accrues immediately, is visible to the introducer immediately, becomes
**withdrawable** only after a 90-day window, and is **recoverable by the issuer** inside it.

The reason this is not scope creep: insurance commission chargeback and fund placement-fee
recovery on early redemption are the same mechanic. Fund fees already need it — if an
investor redeems in week three, the introducer should not keep a trail fee on money that
left. Without a window there is nothing to recover from. That was a hole in the design, not
a second product.

**What the protocol gives us.** Clawback is a first-class asset flag (CAP-35): an issuer can
burn a specific amount of a clawback-enabled asset from a trustline or from a claimable
balance. The docs justify it in exactly our terms — securities regulations in many
jurisdictions require issuers to be able to revoke assets. The docs' own example clears the
clawback flag from a trustline, after which recovery is impossible: **dropping the flag is
literally the vesting event.**

**Limitation, inherited.** The flag is per-trustline, so clearing it releases everything that
holder has, not one tranche. Per-attribution granularity needs either one claimable balance
per fee carrying a time predicate (claimable by the earner after T, clawback-able by the
issuer before T), or vesting state held in the contract. Decide that when `claim_fee` is
written, not before.

**The tension, now resolved.** Native clawback (CAP-35) is a *classic asset* feature and
does not reach a Soroban contract token's balances — so on the face of it, confidential
amounts and issuer recovery looked mutually exclusive.

They are not. OpenZeppelin's confidential package ships a **`clawback` circuit** and a
compliance module exposing `clawback`, `freeze`, `is_frozen` and `force_revoke_spender`.
Clawback is `CircuitType` 100, registered on the verifier like any other circuit, and the
compliant-token example is wired with those hooks. The issuer can therefore recover a
*confidential* balance with a proof, rather than being forced to choose between privacy and
recovery.

This is good news for the vesting design: `recover_fee` has a real path even once fees move
behind the confidential token. It does mean the issuer needs a `clawback` role and the
circuit's verification key registered, which the deployed verifier already has.

**The caveat worth saying before we are asked.** Real chargeback is usually *pro-rata*, not
binary: a holding cancels at month five of twelve and the issuer recovers seven twelfths. A
time-predicate claimable balance cannot express that. This demo is all-or-nothing inside the
window; the product computes pro-rata on a cancellation event. Say it in the pitch rather
than be caught by it.

**Revisit when:** `claim_fee` is implemented, and when anyone asks about pro-rata.

### D10 — The rate is the secret. The subscription is not.
*Added mid-build, after "so what's the point of the confidential stuff, you could just add
up the transfers" — which was right.*

The first design hid the **fee amount**. It did not work, and the objection took one
sentence: fees were paid by a public SAC transfer, the rate sat in public config as
`trail_fee_bps`, and every attribution row carried a public `fee` field. Three independent
leaks of the same number. Encrypting the payout while publishing the multiplicand and the
multiplier is theatre.

**The reframe.** Ask which number a distributor would actually be harmed by publishing. It
is not the subscription — fund flows get disclosed to auditors, administrators, regulators
and often investors as a matter of course. It is the **rate**. What Calder pays this
introducer, versus what it pays that one, is the commercially sensitive term: publish it and
every introducer immediately renegotiates to the best rate in the book, and competitors
learn your distribution economics.

So the contract now stores **no amounts at all** — no fee, no rate, no bps. It records who
introduced whom, for how much, and when, and it marks introductions claimed or recovered.
Settlement happens off-chain against each introducer's privately negotiated rate, paid
through the confidential token.

**What this buys that the first design did not.** Two introducers on 50 and 70 bps are
indistinguishable on chain. `get_ledger` has no field a rate could be derived from, and the
e2e script asserts that by grepping the row keys for `fee`, `rate`, `bps`, `commission` and
`earn` — a test that fails the build rather than a claim in a README.

**The honest limit.** An observer who already knows one introducer's rate learns nothing
about the others, but an observer who watches a single introducer's claims and separately
learns one settlement amount can divide. The protection is that the settlements are
confidential, not that the basis is hidden — the basis is deliberately public. Say that
plainly rather than claim more.

**Why the client holds the rate.** `trailFeeBps` is client config, not a contract read. An
introducer knows their own terms and applies them locally. If you ever find yourself
fetching a rate from the chain, the privacy model has been broken somewhere upstream.

**Who holds the table.** The issuer does, and has to: it negotiated every rate and owes
every rate, so it cannot cost its own liability from a single number — a ledger priced at
one rate is wrong for every introducer but one. So the issuer's client takes a `rates` map
and an introducer's client takes none, which puts the asymmetry in the type rather than in a
comment. An introducer's client cannot compute another introducer's fee even by accident,
because it was never given the input. In production that table comes from the issuer's own
systems, where the agreements already live; here it comes from fixtures.

**Revisit when:** anyone proposes putting a rate, a fee or a total on chain "just for the
demo", or asks why the subscription amounts are public.

### D11 — Every state change emits an event.
*Added after review: only `claim` did.*

`subscribe`, `register_introducer` and `recover` all mutated storage silently. The README
claimed third parties could audit attribution off the chain, and for three of the four
state changes there was nothing to audit — worst of all for `recover`, since a clawback is
the single action a distributor most wants evidence of and it announced nothing.

All four now publish. The payloads carry only values that are already public by design:

| event | topics | data |
|---|---|---|
| `register` | `register`, code | owner address |
| `subscribe` | `subscribe`, code | attribution id, subscribed amount |
| `claimed` | `claimed`, code | the ids claimed |
| `recovered` | `recovered`, code | the attribution id |

**What is deliberately absent.** No totals. `claim` publishes ids rather than a sum, because
one number would hand an observer the exact settlement basis and undo D10. Nothing carries a
rate, a fee or an earnings figure, for the same reason.

**Why events rather than polling.** Both work; events make the history streamable and
timestamped without a client diffing `get_ledger` against its own previous answer. Linking a
`claimed` event to the confidential transfer that follows it tells an observer *who* was paid
and *when* — never *how much*, which is the property D10 actually protects.

**Revisit when:** a new entry point is added, or someone wants to publish a total.

### D12 — The issuer can pay without being asked.
*Added after review of the UX pass: the screens promised something the contract could not do.*

`claim` requires `introducer.owner.require_auth()`. That made being paid an action the
introducer had to remember to take, while the scout dashboard was promising they would never
have to chase a commission. One of the two had to move.

So the contract now also has `settle(code)`, authorised by the **issuer**, marking exactly
the same rows and emitting exactly the same `claimed` event. `claim` stays as the
introducer's optional *collect now*. Downstream nothing can tell them apart, which is the
point: the book, the ledger and the settlement service all care that an introduction is
paid, not who pressed the button.

**Why one shared body.** Both route through a private `mark_settled`. Two copies of "which
rows are payable" would drift, and the copy that drifted would be the one deciding whether
somebody gets paid. The tests cover the case that matters — the issuer settling does **not**
pay a row the issuer previously clawed back, even though the issuer is the one asking.

**What this does not do.** It does not make the fund console's *Run payout* button real.
That needs the issuer to sign, and the live client still has no signer at all, so
`runSettlement` stays undefined and the UI says so. The contract is no longer the thing
blocking it.

**Revisit when:** a signer exists, or someone wants settlement to cover every code in one
call rather than one code at a time.

### D13 — The investor's only credential is a passkey.
*Added while building the Calder investor portal (`site/`).*

A seed phrase is a non-starter for the investor this product is aimed at. Nobody moves six
figures into a fund through a browser extension that asks them to write twelve words on
paper, and every demo that hand-waves this is quietly assuming the hardest part away.

So `contracts/passkey-wallet` is a Soroban smart account whose signer is a WebAuthn
credential. The investor's authority lives in the secure element of their phone or laptop —
Touch ID, Face ID, Windows Hello — and `__check_auth` verifies the assertion on chain with
`secp256r1_verify`, which the host does natively.

**What is verified, and why each check earns its place.** Verifying the signature alone is
not enough. The contract also requires that the credential is registered, that `rpIdHash`
matches the domain the wallet was created for, that user presence *and* user verification
flags are set, that the ceremony is `webauthn.get` and not `webauthn.create`, and that the
challenge inside `clientDataJSON` is exactly this transaction's authorization payload. Drop
any one and there is a way in: an assertion minted for another site, a registration
ceremony replayed as a payment, a tap standing in for a fingerprint, or — the one that
matters most — an assertion for one transfer authorising a different one.

**The decoy challenge.** The contract scans forward for the first `"challenge":"` and takes
that. It would be cheaper to let the caller say where the challenge is, and it would be
wrong: an attacker could bury a second `"challenge":"…"` inside a string field and have the
contract read theirs instead of the one the user approved. There is a test for exactly this.

**Low-S is the client's job.** WebAuthn returns DER, and about half of all signatures come
back with `s` in the upper half of the curve order, which the host rejects. The browser
unwraps and normalises before sending. Getting this wrong produces a wallet that works
roughly half the time, which is far harder to debug than one that never works.

**What is missing.** Attestation is not verified, so the server takes the browser's word for
the public key — only a risk to the person doing it, but a real deployment that cared which
devices were permitted would check. There is no social or guardian recovery: the recovery
story is "add a second device before you lose the first", and the contract refuses to revoke
the last signer because that would not revoke a device, it would destroy the account.

**Revisit when:** recovery needs to survive losing every device, or a per-credential spend
policy is wanted — `auth_contexts` is already passed to `__check_auth` and ignored, which is
where a session-key model would live.

### D14 — The relayer pays fees and cannot spend.
*Added with D13.*

An investor who has to acquire XLM before they can buy a fund will not buy the fund. So the
site holds one Stellar key that pays every fee and deploys every wallet.

This is deliberately not custody. A transaction touching an investor's wallet carries a
Soroban authorization entry the relayer cannot produce, because producing it needs a WebAuthn
assertion over that exact payload from a secure element the server has never seen. The worst
the relayer can do is refuse to submit. That is the right amount of power for the component
whose entire job is to make fees somebody else's problem.

**The fund issuer's key is not on the web tier at all.** Earlier drafts had the server mint
test USDC, which meant holding the asset administrator's key next to an HTTP handler. It now
disburses from its own float by ordinary transfer, and the issuer key stays in the operator's
CLI where it belongs.

**Wallet addresses are derived, not stored.** `salt = sha256(credentialId)`, deployer = the
relayer, so the mapping from passkey to wallet is arithmetic. Signing in is: the
authenticator volunteers a discoverable credential, the server derives the address, the chain
says whether it exists. No user table, no password, no session store, nothing to breach.

**Revisit when:** the site runs as more than one process — the pending-authorization map is
in memory, which is the one thing that would have to move.

### D15 — The portal is server-rendered.
*Added with D13.*

`site/` is rendered on the server so an investor's first paint already contains their real
balance and their real position, read from testnet during the request. The browser ships no
Stellar SDK and holds no key; the only thing it does that the server cannot is ask the secure
element to sign.

**The wallet cookie is not an auth token.** It holds a public contract address and decides
one thing: whose balances the page renders. Forging it shows you somebody else's public
balance, which the chain shows anybody who asks. Every action still needs a fresh assertion
over that specific transaction.

**Two gotchas, both of which fail silently.** `getEvents` is a forward scan with a
per-request budget, not "the last N events" — starting a day back and asking for 100 returns
whatever it found before the budget ran out, which for a new account is nothing. And a
`#[contracttype]` struct is an ScMap with **Symbol** keys; `nativeToScVal` on a plain object
gives String keys, and the host rejects that from deep inside its own struct unpacking, a
long way from anything that mentions keys.

**Revisit when:** the site needs to be more than a demonstration — it is marked as a
fictional manager on every page, and should stay that way.
