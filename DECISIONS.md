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
calls. Neither client has yet agreed to be named, and one has grant terms that stay
internal. So: "a Singapore-based tokenized fund-of-funds manager" and "an RWA vault
issuer" until someone says otherwise in writing.

**Revisit when:** both reply.

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
