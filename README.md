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
end users. We could not find a Stellar repo or SCF submission that handles referral,
introducer or placement-fee attribution.

## What it does

```
Introducer link → Passkey wallet onboarding → Issuer authorizes trustline
→ USDC subscription → Fund units minted → Confidential trail fee accrues
```

An introducer registers once and gets a link. When an investor subscribes through that
link, the referral is recorded onchain and the introducer's trail fee accrues
automatically. Fee amounts are held in a Confidential Token, so they are visible only to
the introducer, the issuer and an auditor — not to the public and not to other
introducers.

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

We are deliberately *not* making investor holdings confidential, for a reason worth stating
plainly: as of the current release, [the Stellar privacy docs](https://developers.stellar.org/docs/build/apps/privacy#confidential-tokens)
note that the verifier accepts only **non-zero-knowledge UltraHonk proofs**, so OpenZeppelin
does not guarantee that proofs keep balances and amounts private. Zero-knowledge
verification is in progress. That is fine for a testnet demo of a fictional fund, and it is
not fine for real investor positions.

So: fees-only now, holdings when ZK verification lands. The architecture does not change —
the same primitive applies to the unit token — which is why we are comfortable calling it a
roadmap item rather than a redesign.

## Prior art, and how this differs

| Project | What it does | How we differ |
|---|---|---|
| [QuietBook](https://github.com/karagozemin/QuietBook) | Confidential bookbuilding for tokenized RWAs | Hides bids *during* a raise. We handle attribution and fees *after* one. Closest neighbour. |
| [confidential-payroll-stellar](https://github.com/berkay1532/confidential-payroll-stellar) | Private salaries, auditable totals | Same privacy shape, different relationship. Useful wiring reference. |
| [stellar-rwa-web](https://github.com/RWA-ToolKit/stellar-rwa-web) | Issuance, allowlists, dividends | Issuance is covered ground; we build the distribution layer on top. |
| [OZ confidential token demo](https://github.com/brozorec/stellar-confidential-token-demo) | Contracts, SDK, in-browser proving | Reference for the proving path. Targets the earlier developer preview, so expect API drift. |
| [stellar-confidential-token-sdk](https://github.com/aguilar1x/stellar-confidential-token-sdk) | Client layer + indexer for OZ confidential tokens | Closest existing client layer; read before writing our own. |

## Who pays, and why this is a business

The issuer or fund manager pays. Distributors are already paid placement and trail fees in
traditional funds — this makes that layer programmable, private and auditable. Revenue:
per-fund SaaS plus a small basis-point platform fee on introduced AUM, wrapped in the
service of designing and running the introducer programme.

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
