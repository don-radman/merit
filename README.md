# Introducer Rails

Confidential, onchain attribution and fee payouts for whoever brings a qualified investor
to a tokenized fund.

**HackMeridian 2026** · Testnet only · fictional fund · play money
**Tracks:** Stellar Unlocked · Stellar Composed

On screen the product is called **Merit** — *credit where it's due*. Value earned through
action; "on the merits" in legal and financial use; warm in everyday speech. *Introduced
via Merit.* The repo keeps its working name; `PRODUCT.name` in `src/lib/fixtures.ts` is
the one place the brand lives.

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

## What it does

```
Introducer link → Passkey wallet onboarding → Issuer authorizes trustline
→ USDC subscription → Fund units minted → Confidential placement fee accrues
```

An introducer registers once and gets a link. When an investor subscribes through that
link, the referral is recorded onchain and the introducer's placement fee accrues
automatically.

**Placement, not trail.** The contract settles **once**, on the subscription basis, after the
vesting window — which is a placement fee. A trail fee recurs on assets held, and nothing here
recurs. The same rails do trail with a periodic settlement run over the same book, but this
build does not, so calling it a trail fee would be claiming a product we have not written.
(The client field is still `trailFeeBps`: renaming it reaches the frozen interface and the UI,
and was not worth doing mid-build. The number it holds is a placement rate.) The commission itself never touches the chain: the rate is private between the
issuer and that introducer, and settlement is a confidential transfer out of the issuer's pool.
**Nobody can tell what an introducer earns.**

## The three screens

This build ships **exactly three screens**. Anything not on this list is out of scope.

### 1. Investor — subscribe (`/i/<CODE>`)
Opens an adviser's link, creates a passkey account (no seed phrase, no gas, and the word
"wallet" never appears), passes a mock KYC step, subscribes in US dollars, and sees a
plain-English holdings statement. Five stages are shown as visible progress; the fund
approving the account is the one real wait. There is **no proof on this path** — the
contract records attribution in the clear by design, and the only proof in the system is
the fund's, at settlement. Add `?frame=phone` to record it in a phone-sized frame.

### 2. Adviser — your book (`/scout`)
The hero screen, built for someone who has never used web3. A share link, three numbers
(Earned · On its way · Paid out), and one row per introduction with a status that answers
"when do I get paid": **Vesting → Ready → Paid**, or **Reversed** if the client exited
early. A **"What the world sees"** toggle re-renders the same screen as the public record:
the fees become dots and a banner says what the chain holds. Fee figures are computed at
the adviser's own rate and shown to them only. A one-time **Set up payouts** card stands in
for confidential-account registration, framed like adding a bank account.

### 3. Fund — attribution ledger (`/issuer`)
Every attribution across all advisers, each fee at *that* adviser's private rate (the fund is
the one party that holds every rate), outstanding liability, and a **Run payout** button —
the "you never chase" promise made literal.

Two honesties about this screen. The payout button is a **simulation**: in stub mode it
plays the settlement back from fixtures, and in live mode the client declines it altogether
so the console says so, because this client has no signer. Real confidential settlement runs
from `scripts/confidential.sh settle`, and wiring the button to it is the next integration
step. And the auditor line compares a total against itself — this client does not hold the
auditor key, which its own heading says. Treat it as the shape of the reconciliation, not a
performed one.

The walkthrough for the video is in [DEMO.md](DEMO.md); the visual system is in
[DESIGN.md](DESIGN.md).

## The investor portal (`site/`)

The three screens above are the mechanism. [`site/`](./site/README.md) is what it looks like
to somebody actually using it: a server-rendered site for **Calder Asset Management**, a
fictional Singapore manager distributing the fund through introducers.

```sh
node scripts/site-setup.mjs   # once
npm run site:dev              # http://localhost:5174
```

An investor opens their adviser's link, creates a passkey, and subscribes with a
fingerprint. There is no seed phrase, no extension, no XLM and no gas — Calder deploys the
wallet and pays the fees, and cannot touch what is in it. The adviser's book is a public
read at `/advisers/<CODE>`, showing every introduction and its state, and deliberately
unable to show the commission, because no rate is on the chain to show.

Proof it works rather than demos: `cargo test -p passkey-wallet` (13 host tests over real
P-256 signatures) and `npm run site:e2e` (the whole flow against testnet, with a simulated
authenticator producing byte-identical payloads to a browser's). See D13–D15 in
[DECISIONS.md](./DECISIONS.md).

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Fund unit | Classic Stellar asset via its SAC | The regulated-asset controls institutions ask for — `AUTH_REQUIRED`, freeze, clawback — are **asset flags we have not set on the testnet issuer**. See below. |
| Subscription currency | USDC on testnet | What an investor would really send |
| Attribution + minting | Soroban contract | Records code → investor → amount, mints units, accrues fee |
| Introducer fees | OpenZeppelin `stellar-confidential` (stellar-contracts v0.8.0) | Fee amounts encrypted; auditor holds a view key |
| Investor wallet | Passkey smart wallet (`contracts/passkey-wallet`) | No seed phrase, no gas — the "my mum could use it" bar. `__check_auth` verifies a WebAuthn assertion with `secp256r1_verify`; D13 |
| Fees | Relayer account holding no passkey | Pays and deploys; cannot authorise anything, so it is not custody; D14 |
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

**The compliance controls are not switched on.** Horizon reports the testnet issuer with
`auth_required`, `auth_revocable` and `auth_clawback_enabled` all **false**. So the investor
flow's "the fund is approving your account" stage is presentational today, and nothing would
stop a holder transferring units to an unapproved account. Turning it on is `set-options` on
the issuer plus a `set_authorized` step wherever a trustline is created — but the flags only
govern trustlines opened *after* they are set, so the existing demo balances would not come
under them without reissuing. We would rather say that than let the stage imply an enforcement
that is not there.

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
| `contracts/passkey-wallet/` | contracts dev | cargo crate (Soroban) |
| `site/` | contracts dev | node + Vite (its own project; does not touch the root app) |
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
