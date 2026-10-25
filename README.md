# Introducer Rails

Confidential, onchain attribution and fee payouts for whoever brings a qualified investor
to a tokenized fund.

**HackMeridian 2026** · Testnet only · fictional fund · play money
**Tracks:** Stellar Unlocked · Stellar Composed

---

## The problem

From two client calls in the week before the hackathon (anonymised — naming permission pending):

- **A Singapore-based tokenized fund-of-funds manager** (~$200M RWAs) is launching a
  tokenized multi-currency money market fund and needs distribution in Australia and
  New Zealand. Their distribution partners expect placement and trail fees, exactly as in
  traditional funds. Many of their clients do not know much about blockchain.
- **An RWA vault issuer** moving from retail to family offices, institutions and HNW
  holders is willing to share 5–10% with anyone who brings qualified AUM. Target deals
  are seven figures. They want a small, invite-only advocate group chosen by actual
  usage, not message counts.

Both described the same gap, independently. Tokenized funds can be *issued* — issuance is
a solved problem on Stellar. But the people who bring investors in are paid by
spreadsheet and invoice, months late, with commercially sensitive numbers sitting in a
file that everyone who touches the deal can read.

Stellar's own position is that the bottleneck has moved from issuance to getting assets to
end users.

**On novelty, stated accurately.** Referral attribution on Stellar is not unclaimed ground:
[Fuul](https://fuul.xyz) is an incentives and affiliate engine — conversion events, automated
reward payouts, used by Coinbase, Kraken, Morpho and dYdX — with two SCF submissions to deploy
natively on Stellar. If the claim were "nobody does referral attribution", it would be false
and a reviewer would find it in one search.

What we could not find is anyone treating the **commercial terms** as the thing to protect.
Fuul's model is growth incentives, where campaigns are public by design. Ours is regulated
fund distribution, where the rate a manager gives one distributor is exactly what the others
must not see. That is the gap, and it is narrower and more defensible than "first to do
referrals".

## What it does

```
Introducer link → Passkey wallet onboarding → Issuer authorizes trustline
→ USDC subscription → Fund units minted → Confidential trail fee accrues
```

An introducer registers once and gets a link. When an investor subscribes through that
link, the referral is recorded onchain and the introducer's trail fee accrues
automatically. The commission itself never touches the chain: the rate is private between the
issuer and that introducer, and settlement is a confidential transfer out of the issuer's pool.
**Nobody can tell what an introducer earns.**

## The three screens

This build ships **exactly three screens**. Anything not on this list is out of scope.

### 1. Investor — subscribe
Opens an introducer link, creates a passkey wallet (no seed phrase, no gas), passes a mock
KYC step, subscribes with USDC, and sees a plain-English holdings statement. The six flow
stages above are shown as visible progress, because the trustline authorization and the
proof generation are both real waits.

### 2. Introducer — my book
Their own book and nothing else: who they introduced, how much each subscribed, fee
accrued, fee already claimed, and a claim button. Fee figures are decrypted client-side
for this introducer only.

### 3. Issuer — attribution ledger
Every attribution across all introducers, total subscribed, and outstanding fee liability.
Includes an auditor reconciliation line: totals reconcile through the auditor view key
without any individual position being public.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Fund unit | Classic Stellar asset, `AUTH_REQUIRED` + clawback, via its SAC | Issuer keeps freeze / clawback / trustline approval — the regulated-asset controls institutions actually ask for |
| Subscription currency | USDC on testnet | What an investor would really send |
| Attribution + minting | Soroban contract | Records code → investor → amount, mints units, accrues fee |
| Introducer fees | OpenZeppelin `stellar-confidential` (stellar-contracts v0.8.0) | Fee amounts encrypted; auditor holds a view key |
| Investor wallet | Passkey smart wallet | No seed phrase, no gas — the "my mum could use it" bar |
| Claim path limits | OpenZeppelin policy | Bounds what the claim path can do |

**Fees are confidential. Holdings are not.** See below.

## What is confidential — and what we are not claiming

Confidential Tokens encrypt balances and transfer amounts while leaving sender and
recipient addresses public. We apply them to **introducer fee balances only**.

**What the chain shows.** Who introduced whom, and how much each investor subscribed. Both are
public transfers and we do not pretend otherwise. The issuer's confidential pool is topped up in
the open too — a deposit is public-to-private by construction, so the amount entering cannot be
hidden. That disclosure is aggregate: it says how much the issuer has set aside for
distribution, not who gets what.

**What the chain does not show.** Any rate, any commission, or any introducer's earnings. The
contract stores no fee and no rate — it is an attribution and vesting ledger, nothing more — and
every payment out of the pool is a `confidential_transfer` whose amount appears nowhere.

**What the chain emits.** Every state change publishes an event, so attribution can be audited
without trusting our UI or diffing the ledger against a previous answer:

| event | topics | data |
|---|---|---|
| `register` | `register`, code | owner address |
| `subscribe` | `subscribe`, code | attribution id, subscribed amount |
| `claimed` | `claimed`, code | the ids claimed |
| `recovered` | `recovered`, code | the attribution id |

`claim` publishes **ids, not a total**. One number there would hand an observer the exact
settlement basis and undo the whole point. Until review caught it, only `claim` emitted at all —
a clawback changed a flag and announced nothing, which is the one action a distributor most wants
evidence of. See DECISIONS.md D11.

That boundary is deliberate, and it is the one that matters commercially. Fund flows get
disclosed; distribution terms do not. A manager will publish what came in and will not let one
distributor learn another's rate.

**Where the rates live in this repo, and why that is not the claim.** A demo has to put
numbers somewhere: `src/lib/fixtures.ts` maps the two fictional introducers to 50 and 70 bps
so the screens have something to render. The claim is about what the **chain** and the
**other parties** can see — not about a public demo repo for an invented fund. In production
the table sits in the issuer's own systems, where the agreements already live, and the only
copy the introducer's client ever holds is its own single rate.

That distinction is easy to say and was easy to get wrong: `contracts/rates.example.json`
shipped byte-identical to the gitignored `contracts/rates.json`, live values and all, under a
comment calling itself the secret this design protects. It is a template of fake codes now,
and `./scripts/check-secrets.sh` fails the run if the template ever carries a live code or
rate again. The old values are still in git history at `45f82f7`; they are fictional, which
is the only reason that is a note rather than an incident.

**Measured, not assumed.** `contracts/SPIKE.md` records what we actually read off the chain at
each step, including the deposit event that carries its amount in the clear. An earlier draft of
this README claimed more than the code did; that is how we found it.

**The one thing we do not yet guarantee.** As of the current release, [the Stellar privacy
docs](https://developers.stellar.org/docs/build/apps/privacy#confidential-tokens) note that the
verifier accepts only **non-zero-knowledge UltraHonk proofs**, so OpenZeppelin does not guarantee
that proofs keep amounts private. Zero-knowledge verification is in progress. Fine for a testnet
demo of a fictional fund; not fine for real money, and we would not ship it as such.

## Operational notes

The issuer's confidential pool is spendable only with its opening `(v, r)`, held off-chain.
**Lose that and the pool is unspendable** — no key recovers it, because there is no key. It is
rolled forward on every settlement.

Every account that touches the confidential token must be allowlisted *before* it registers,
including contracts. Miss it and you get a bare `Error(Contract, #3602)` from deep inside the
token with no indication of the cause.

## Prior art, and how this differs

| Project | What it does | How we differ |
|---|---|---|
| [QuietBook](https://github.com/karagozemin/QuietBook) | Confidential bookbuilding for tokenized RWAs | Hides bids *during* a raise. We handle attribution and fees *after* one. Closest neighbour. |
| [confidential-payroll-stellar](https://github.com/berkay1532/confidential-payroll-stellar) | Private salaries, auditable totals | Same privacy shape, different relationship. Useful wiring reference. |
| [stellar-rwa-web](https://github.com/RWA-ToolKit/stellar-rwa-web) | Issuance, allowlists, dividends | Issuance is covered ground; we build the distribution layer on top. |
| [OZ confidential token demo](https://github.com/brozorec/stellar-confidential-token-demo) | Contracts, SDK, in-browser proving | Reference for the proving path. Targets the earlier developer preview, so expect API drift. |
| [stellar-confidential-token-sdk](https://github.com/aguilar1x/stellar-confidential-token-sdk) | Client layer + indexer for OZ confidential tokens | Closest existing client layer; read before writing our own. |
| [Fuul](https://fuul.xyz) | Incentives and affiliate engine; conversion events and automated reward payouts | The real prior art for attribution. Public campaigns by design; we hide the commercial terms. |

## Who pays, and why this is a business

The issuer or fund manager pays. Distributors are already paid placement and trail fees in
traditional funds — this makes that layer programmable, private and auditable. Revenue:
per-fund SaaS plus a small basis-point platform fee on introduced AUM, wrapped in the
service of designing and running the introducer programme.

**The same contract pays brokers.** Insurance commission chargeback and fund placement-fee
recovery are the same mechanic, and the vesting window is a config value — two markets, one
codebase. An ecosystem scan found the insurance work on Stellar is all claims-side
parametric cover; nothing touches commission or distribution.

**Community mode** is the same contract with a different trigger: an advocate earns a
capped reward when a verified outcome lands. Not built this weekend; noted because it is
one config change, not a second product.

## Scope discipline

Cut in this order if behind:

1. AI explainer and NAV price feed
2. Confidential holdings (keep confidential fees only) — already cut, see above
3. Community mode (slide, not code)
4. Issuer ledger screen (static screenshot in the demo video)

**Never cut:** the passkey subscription and the confidential fee claim. That is the demo.

## How we used AI

Contracts and the confidential-token wiring were written by hand — proof verification and
attribution arithmetic are where a confident wrong answer costs you the demo. UI was built
by agent against the frozen interface in `src/lib/types.ts` and reviewed by driving the
screens, including the failure paths. Research and the ecosystem scan used the Raven MCP;
the ZK verifier caveat above came out of that scan and changed the architecture. Decisions
and their reasoning are in [DECISIONS.md](./DECISIONS.md).

## Legal

Placement and referral fees on securities are regulated (licensing, disclosure). This demo
uses a fictional fund on testnet with no real money. A real deployment runs inside the
issuer's licensed framework. Not legal advice, not an offer.

## Repo layout, and who owns what

Two toolchains in one repo, no monorepo tooling — see [DECISIONS.md](./DECISIONS.md) D8 for
why not Turborepo.

| Path | Owner | Toolchain |
|---|---|---|
| `src/screens/`, `src/components/` | UI dev | npm / Vite |
| `src/lib/` | **shared — frozen** | npm |
| `src/bindings/` | contracts dev (generated, committed) | `stellar contract bindings typescript` |
| `Cargo.toml`, `AGENTS.md` | contracts dev | cargo workspace root |
| `contracts/introducer-rails/` | contracts dev | cargo crate (Soroban) |
| `scripts/` | contracts dev | node + Stellar CLI |

Three rules that keep two people out of each other's way:

1. **One owner per directory.** Need a change in someone else's? Say it out loud, do not
   just edit it. Two people editing the same file at hour 20 is how a working demo breaks.
2. **`src/lib/types.ts` is the exception** — shared, frozen, and any change to a signature
   is a conversation before it is a commit. Everything on both sides is built against it.
3. **Generated bindings are committed, not ignored**, so the UI builds on a machine with no
   Rust toolchain installed.

## Running it

```bash
npm install
npm run dev          # UI against the stub client — no chain needed
```

The UI talks only to the client in `src/lib/`. `STUB` mode returns fixture data so the
screens can be built and demoed with no contracts deployed; see
[src/lib/README.md](./src/lib/README.md) for the swap to live testnet.

Against the chain:

```bash
./scripts/e2e-testnet.sh     # deploys a throwaway instance and asserts no rate leaks
./scripts/seed-demo.sh       # leaves a deployment whose book shows all four states
VITE_CLIENT_MODE=live npm run dev
```

The two scripts do different jobs. `e2e-testnet.sh` is the test: it deploys a fresh instance
each run, so running it again is the reset, and it fails the build if a rate-bearing field
ever appears on a ledger row. `seed-demo.sh` is the fixture: it leaves one deployment holding
a claimed, a claimable, a vesting and a clawed-back introduction at once, across two
introducers on deliberately different terms.

Its ordering is forced by the contract rather than chosen — `recover` refuses a vested row,
and `claim` takes every vested row for a code in one call — which is why it waits twice and
why the seeded window is minutes rather than the 90 days production would use. Read the
header comment before changing the order; it will not do what you expect.

Point the UI at whatever it deploys with `VITE_CONTRACT_ID`, and set
`VITE_VESTING_WINDOW_SECS` to match — the window is fixed at `initialise` and the contract
exposes no getter, so the client cannot discover it.
