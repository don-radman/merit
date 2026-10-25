# Contracts — build notes

## Pinned dependencies

| What | Where | Note |
|---|---|---|
| OpenZeppelin Stellar contracts | `OpenZeppelin/stellar-contracts` | **v0.8.0 or later.** The confidential token lives here as `stellar-confidential`. Active repo, Rust, audited at v0.8.0. |
| Confidential token deployment examples | same repo | Verifier and auditor registries, allowlist policy, compliant token, factory. Start from these, do not hand-roll. |

**Do not write circuits.** The v0.8.0 audit covers the contracts *and* the circuits. Using
the library is the whole point of the "Composed" track — less code, more thinking.

## Reference repos, graded

- `aguilar1x/stellar-confidential-token-sdk` — **read this first.** The closest existing
  client layer for OZ confidential tokens, plus an indexer that replays history. Maintained,
  runs against testnet. This is the layer `src/lib/live.ts` is replacing; borrow from it.
- `brozorec/stellar-confidential-token-demo` — contracts, SDK and **in-browser proving**.
  The proving path is the hard part of the frontend story, so this is worth reading. Caveat:
  it targets the earlier developer preview, so expect API drift from v0.8.0.
- `stellar-experimental/who-ate-gerald` — freshest working confidential-token integration
  (active October 2026), SDF-adjacent. Best guess at current API usage.
- `berkay1532/confidential-payroll-stellar` — same privacy shape as our fee ledger: private
  amounts, auditable totals.
- `jayz22/stellar-confidential-transfer` — **read for design only, do not depend on it.**
  Last commit September 2025, dormant. It is the original SDF prototype and predates the OZ
  library by a year.

## The ZK caveat, and what it means for us

Per the Stellar privacy docs: the current verifier accepts only **non-zero-knowledge
UltraHonk proofs**, so OpenZeppelin does not guarantee that proofs keep balances and amounts
private. ZK verification is in progress; the docs say read the ZK setting notes before using
confidential tokens with real assets.

Consequences:
- Fees are confidential, holdings are not. See `DECISIONS.md` D1.
- Say this out loud in the README and the pitch. Anyone reading it will already
  know exactly where this primitive stands; pretending otherwise reads worse than the
  caveat does.
- Testnet only. Not negotiable, and nothing of value is at stake anyway.

## Hour 4 spike — do this before any real contract work

**The full runbook is in [SPIKE.md](./SPIKE.md)** — testnet identities, what UltraHonk
actually requires, and the two paths to a verified proof. Summary below.

**Target: one UltraHonk proof verified on testnet.** Not "a confidential balance that goes
up" — a verified proof. Everything else is downstream of that working.

Then immediately **measure how long proving takes** and put the number in
`src/lib/fixtures.ts` as `PROVING_DELAY_MS`. If it is 10+ seconds in a browser, the demo
video needs to pre-warm the claim or route it server-side, and the UI dev needs to know
today, not tomorrow morning.

## Build order

1. Testnet accounts; issue the fund asset with `AUTH_REQUIRED` and clawback; deploy its SAC.
2. **Spike: verified proof on testnet.** Stop here if it fails — see the fallback below.
3. Subscription + attribution contract: records code → investor → amount, mints units.
4. Confidential fee balance: accrue on subscribe, claim with auditor view key registered.
5. The CLI script that drives the whole flow end to end. This is the safety net: if the UI
   dies at 4am, the CLI demo still exists and is still a submission.
6. **The one-command reset script.** Needed before integration, not after — "full flow runs
   twice without a reset" is the overnight gate and you cannot hit it without this.

## Fallback if the proof does not land

Trigger: no verified proof on testnet by Sunday evening.

Accrue fees in a plain token, keep `IntroducerRailsClient` byte-for-byte identical so the UI
never notices, document the confidential design in the README, and pitch the privacy
architecture instead of demoing it.

## Never cut

The passkey subscription and the confidential fee claim. That is the demo.

---

## Before anything else: install the toolchain

Neither cargo nor the Stellar CLI was present when this scaffold was written. Budget time
for this at hour 0, because nothing else can start until it is done:

```bash
# 1. Rust. Needs >= 1.84.0 for the wasm target below.
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. The wasm target. An IDE will NOT add this for you, and without it
#    `stellar contract build` fails with "can't find crate for `core`".
rustup target add wasm32v1-none

# 3. The Stellar CLI. Homebrew is quickest on macOS; the cargo route
#    (`cargo install --locked stellar-cli`) also needs a C build system.
brew install stellar-cli
stellar --version
```

The crate is already scaffolded (`stellar contract init`, CLI v28.1.0, soroban-sdk 28).
Layout, after flattening the scaffold's own nesting:

```
Cargo.toml                        workspace root, members = ["contracts/introducer-rails"]
AGENTS.md                         the CLI's own brief for coding agents
contracts/introducer-rails/       the crate
  Cargo.toml                      name = "introducer-rails", soroban-sdk from the workspace
  Makefile                        `make build` -> stellar contract build
  src/lib.rs                      `pub struct Contract;` — replace the sample `hello()`
  src/test.rs
```

Build with `stellar contract build`, not `cargo build --target ...` — the CLI applies the
flags and metadata the network expects, and optimises the wasm. Output lands in
`target/wasm32v1-none/release/introducer_rails.wasm` at the repo root.

To add a second contract later: `stellar contract init . --name <other>`, then add it to
`members` in the root `Cargo.toml`.

## What the contract has to expose

The TypeScript interface is already frozen in `src/lib/types.ts`, so the contract surface is
not an open question. Minimum set, named to match:

| Client method | Contract function | Notes |
|---|---|---|
| `resolveCode` | `get_introducer(code) -> Introducer` | Read-only. Cheap. Do this one first. |
| `registerIntroducer` | `register_introducer(owner, display_name) -> code` | Code generated onchain so it cannot collide. |
| `subscribe` | `subscribe(investor, code, usdc_amount) -> (units, fee)` | Pulls USDC, mints units, writes attribution with a `vests_at`, accrues confidential fee. The big one. |
| `getHoldings` | SAC `balance(investor)` | Classic asset via its SAC; no custom function needed. |
| `getBook` | `get_book(code) -> Vec<Attribution>` | Plus the confidential balance read, decrypted client-side. |
| `claimFee` | `claim_fee(code) -> amount` | Confidential transfer out, policy-limited. **Pays only entries past `vests_at`**; reject `not-yet-vested` when accrued but unvested. |
| — (issuer) | `recover_fee(attribution_id)` | Issuer recovers an unvested, unclaimed fee when an investor redeems early. See DECISIONS.md D9 for the clawback-vs-confidential tension. |
| `getLedger` | `get_ledger() -> Vec<Attribution>` | Issuer-only. Paginate if it gets long; four rows in the demo. |
| `getAuditorAttestation` | auditor view-key read | Sum encrypted balances, compare to stated liability. |

Generate bindings as soon as `subscribe` deploys, and **commit them**:

```bash
stellar contract bindings typescript --contract-id <id> --output-dir ../src/bindings
```

Committing the generated bindings means the UI builds on a machine with no Rust toolchain
installed. That matters when only one of you has it.


## Vesting — storage and the choice to make

Each attribution stores `vests_at` (subscription time + the window). `claim_fee` sums only
entries past it; the issuer's `recover_fee` touches only entries before it.

Two implementations, pick when you write `claim_fee`:

1. **One claimable balance per fee**, carrying a time predicate — claimable by the earner
   after T, clawback-able by the issuer before T. Uses the protocol directly, and clearing
   the trustline's clawback flag is itself the vesting event. But the flag is per-trustline,
   so it releases every tranche that holder has at once.
2. **Vesting state in the contract** — a `vests_at` per attribution and an explicit check.
   Per-attribution granularity, at the cost of doing it ourselves.

(2) is almost certainly right for a 28-hour build; (1) is the better long answer. Either
way the client interface does not change, because it already speaks in `vested` and
`vestsAt` rather than in mechanisms.
