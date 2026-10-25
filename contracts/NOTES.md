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


## Confidential fee claim — wired to the live verifier

`claim_fee` makes a cross-contract call into OpenZeppelin's deployed verifier and refuses to
release anything unless the proof is accepted. Verified on testnet against the real verifier:

| Input                  | Result                                      |
|------------------------|---------------------------------------------|
| Garbage 14,592 bytes   | `InvalidProof` (#9) — rejected at the gate  |
| A real UltraHonk proof | passed the gate, then `NothingToClaim` (#6) |

The second case is the one that matters: execution continued *past* the proof check and
failed later for the right reason.

Contract: `CAGT434JHKHHBVENOHNB4FX6NYUMDHTWUPJGK3VDPGATC5PBAYHKFBKU` · verifier wired in at `initialise`.

### The gotcha that cost a deploy

`verify_proof` takes `(circuit_type, public_inputs, proof)` — **public inputs before the
proof**. Cross-contract calls are positional, so swapping the last two returns a clean
`false` rather than an error, which looks exactly like an invalid proof. `claim_fee` now
takes its arguments in the same order so the mistake cannot be made twice.

`claim_circuit` is config, currently `Register` (0) because that is the circuit we have a
working witness for. It becomes `Transfer` (2) once fee balances actually live in the
confidential token.

### What is still public

Fee amounts are still plain `i128` in this contract. The proof gate is real and the verifier
is real, but the *amounts* do not become confidential until the balances move into
OpenZeppelin's confidential token. That is the remaining work, and the client interface does
not change when it happens — `claimFee()` takes no proof argument, because generating one is
the client library's job, not the UI's.

## End-to-end on testnet — passing

`./scripts/e2e-testnet.sh` runs the whole flow against testnet and asserts the outcome:

```
subscribed 250,000.00 TUSDC through CALDER-PR7
investor issued 250,000.00 CSDIF units this run
claimable = 1,250.00            (50 bps, after the vesting window)
claim paid 1,250.00 TUSDC       (proof accepted by the deployed verifier)
PASS
```

Deploys a fresh contract each run, so re-running it **is** the reset. Needs no Noir
toolchain — the claim proof is a committed fixture in `contracts/testdata/`, already
verified by the live verifier.

### Two things this surfaced

**The 90-day instance can never demo a claim.** `claim_fee` compares `vests_at` against real
ledger time and there is no way to advance the clock on testnet, so a subscription made today
is unclaimable until late January. The e2e script deploys its own instance with a 15-second
window. Any instance used for the demo video needs a short window too — it is an argument to
`initialise`, not a code change, but it is easy to forget and impossible to work around live.

**Simulations are faster than you expect.** Twelve read-only `claimable` calls finished inside
a 15-second window, so the first version of the poll loop reported zero and gave up while the
logic was entirely correct. The loop is paced now.

### Amounts

The SACs use 7 decimals, so the script works in stroops and prints human figures. 250,000.00
subscribed at 50 bps is exactly 1,250.00 — the same arithmetic as the UI fixtures, so the
numbers on screen and the numbers on chain tell the same story.


## ✅ claim_fee pays confidentially — verified on testnet

Contract `CBG7RUBLJTIDEY2CQNW2OV2NRRL2LNUQ753DH7IHLHAVVDZTPFMDVQQC`. One subscription of 250,000, one claim of the 1,250 trail fee:

|                                   | before         | after                          |
|-----------------------------------|----------------|--------------------------------|
| contract TUSDC                    | 5,250,000      | **5,248,750**                  |
| confidential token custody        | 12,500,000,000 | **12,500,001,250**             |
| introducer PUBLIC TUSDC           | 25,100,000,000 | **25,100,000,000 (unchanged)** |
| introducer `receiving_commitment` | old point      | **new point**                  |
| `claimable`                       | 1,250          | 0                              |

The fee left the contract and arrived as an encrypted commitment. Nothing about the amount
shows in the introducer's public balance.

### Why deposit, and not confidential_transfer

`confidential_transfer` has to be signed by the party holding the opening of the spending
commitment, and proving is client-side — **a contract cannot generate a proof.** So the
contract can never be the sender of a confidential transfer.

`deposit` needs no proof and a contract can authorize itself, which gives a design where the
vesting window still works:

- while vesting, the fee is a public `i128` the contract holds — which is exactly what lets
  the issuer recover it
- at claim, it is deposited into the confidential token, where the introducer's **balance**
  becomes a commitment. The deposit amount itself stays public (public-to-private by
  construction, plus a `Deposit` event) — see SPIKE.md for what is measured, not assumed
- the introducer later withdraws or transfers it confidentially, proving with their own
  opening

Privacy where it matters, recoverability where it matters, and no contract-side proving.

### Two things that will bite anyone repeating this

**The depositing contract must be allowlisted too**, not just the recipient. The policy
checks every fund-holding account named in the operation. Missing it gives
`NotAuthorizedByPolicy` (3602).

**`authorize_as_current_contract` is required.** The token pulls the underlying with its own
`transfer`, one frame below ours, and a contract must pre-authorize anything it is the source
of below its own frame. Without it: `Error(Auth, InvalidAction)`. The host error names the
function to call, which is the only reason this was quick to fix.

### Still to do

`vesting_window_secs` is **0** on this deployment so the claim could be demonstrated in one
sitting. Production is 90 days (7776000).

## Settlement treasury — set up on testnet

`ir-treasury` = `GCJWYYAIFV2OMODQRXO5N3DUOZYNSTM2DKWVYVU5DL357AKNFXKBUFI4`

Registered on the confidential token with a real proof, allowlisted, holding 50,000,000
stroops of TUSDC publicly and 25,000,000 deposited and merged into its confidential
`spendable_commitment`. It is the sender for confidential settlement.

**Why a separate account and not the issuer.** `ir-issuer` issues TUSDC, and a Stellar
issuer cannot hold a trustline to its own asset — so it can never hold the float it would
pay from. Any settlement sender has to be an account that is not the asset issuer.

**Deriving the first opening without persisted state.** From `storage.rs`:

```rust
// deposit
let c_dep = Grumpkin::mul(e, &Grumpkin::generator(e), amount as u128);  // amount * G
// merge
data.spendable_commitment = Grumpkin::add(e, &spendable, &receiving);
```

A Pedersen commitment is `v*G + r*H`. A deposit has no `H` term, so its blinding is **zero**
and `merge` is additive. A balance built from deposits alone therefore opens to
`{ v: <total deposited>, r: 0 }` — no persisted state needed for the first spend.

After the first `confidential_transfer` the blinding is non-zero and that shortcut is gone:
persist `next` from the envelope **before** submitting, every time. The opening is the only
thing that can spend a commitment.

Both `ir-treasury` and `ir-introducer` registered with `auditor_id` 0, so they share the
auditor key the circuits commit to. A new account on a different auditor id will not
interoperate with them.

## Never confirm a chain write by reading CLI output

This cost real state during settlement, and it is the kind of bug that looks like a
cryptography failure when it is a parsing failure.

A `confidential_transfer` **landed**, but success was being detected by grepping the CLI
output for `Event:`. The grep missed, the write was read as rejected, a rollback restored the
previous opening — and `.conf-state` then pointed at a commitment that no longer existed on
chain. The pool looked unspendable.

It was recovered by recomputing `v*G + r*H` for each candidate opening and comparing against
the chain's `spendable_commitment`, which is also the fix:

- **Persist `next` BEFORE submitting, never after.** The SDK says this outright and it is easy
  to get backwards while the happy path still works.
- **Confirm by recomputing the commitment and comparing to chain state**, never by parsing a
  CLI string. Output formats drift, greps miss, and a false negative here destroys the only
  thing that can spend the balance.

Every `grep -oE "Event:"` in a throwaway diagnostic in this repo's history is the same latent
bug. It is harmless when you are only reading; it is not harmless when a failed read triggers
a rollback.
