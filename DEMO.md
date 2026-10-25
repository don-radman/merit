# Demo walkthrough

Three minutes. One investor, one adviser, one fund — and one claim: the introduction is
public, the rate is not.

This replaces the earlier walkthrough, which was written before `site/` existed and said the
investor's account was a stub. It is not any more. The passkey is real, and it is the single
most valuable thing in the video, because it is the one part no automated test can cover.

## Two surfaces, and which to use for what

| | | |
|---|---|---|
| **Calder portal** | `http://localhost:5174` | The investor and the adviser. Real passkeys, real on-chain writes, server-rendered. **This is the hero.** |
| **Fund console** | `http://localhost:5173/issuer` | The fund's attribution ledger, with every adviser's fee at that adviser's own rate. Live reads. |

Use the Calder portal for everything an investor or adviser does. Use the fund console for
one shot only — the fund's view of all advisers — because it is the only screen that shows
the asymmetry the whole design exists for: the fund holds every rate, the chain holds none.

**Do not press anything on `:5173`.** Its reads are live; its writes are the stub. *Run
payout* is disabled in live mode and says why; *Collect now* on `/scout` is hidden in live
mode for the same reason; the demo bar offers only navigation. There is nothing left to
press, but there is also nothing to gain by trying.

## Preflight

```sh
# 1. Both servers, in separate terminals
npm run site:dev                       # Calder, :5174
npm run dev                            # fund console, :5173 — live mode via .env.local

# 2. Confirm the chain is answering and the adviser resolves
curl -s localhost:5174/i/CALDER-PR7 | grep -o 'Raghunathan Family Office' | head -1
```

- [ ] **Sign out of the portal first.** Visit `/wallet`, Sign out. The video opens with no
      account; if a cookie is left over, the masthead says *Portfolio · Wallet* and the
      first beat is spoiled.
- [ ] **Touch ID works in your browser.** Safari or Chrome on `localhost`. A passkey needs a
      secure context, and `localhost` is one — a LAN IP is not.
- [ ] **The relayer has XLM and USDC float.** Each account opening spends a little XLM and
      credits 250,000 test USDC. Last checked: ~19.09M TUSDC and ~20,000 XLM. Ample.
- [ ] **Window at 1440×900 or wider.** Below ~800px the masthead drops its nav links.
- [ ] **Browser zoom at 100%**, and hide bookmarks — the Calder masthead is sticky and sits
      right under the chrome.
- [ ] Do **not** serve `site/dist` — the recording wants the dev server.
- [ ] **Read the ledger immediately before the take**, and do not write any figure into the
      narration from memory. It moves: it went 8 → 9 rows during one afternoon of checks.

## Never on camera

**`site/.env.local` holds the relayer's secret key in plaintext.** It is gitignored and mode
600, and none of that helps if it is on screen. No editor windows, no `cat`, no `ls` of
`site/`, no shell history. The beat 6 terminal should be a fresh shell in the repo root.

**Do not click Claim or Collect.** `claim` takes *every* vested row for a code in one
irreversible call — one click consumes all of CALDER-PR7's payable rows and the next one
returns `NothingToClaim`. There is no undo, and it would gut the adviser's book you are
about to film.

**Do not run `npm run site:e2e` or `scripts/seed-demo.sh` beforehand.** The first adds an
introduction and two sends, moving every figure you just read. The second deploys a brand
new contract, sleeps about eleven minutes, and does not write the new id back — the portal
would still be pointing at the old one.

**Nothing on `:5173` needs cropping any more.** In live mode the demo bar at the bottom
offers only navigation, and the reconciliation panel at the foot of `/issuer` says plainly
that this client holds no auditor key and reads the fund's own ledger. Neither is the shot,
but neither contradicts the shot either.

**Don't film `cargo test`.** It prints seven SDK deprecation warnings before the two green
lines. State the count instead: 23 host tests, 10 and 13, none failing.

**Vocabulary is aligned.** Both surfaces say *adviser* (one constant, `PRODUCT.roleLabel`),
and both say *Payable* for a vested, unpaid row. Beat 7 cuts between them without a seam.

**Don't leave the confirm sheet open.** A prepared authorisation is valid for about ten
minutes and lives only in the one server process's memory. Click, then touch the sensor.

## The one timing constraint

The deployed contract's vesting window is **300 seconds**. A subscription made on camera
reads *Vesting* for five minutes and then flips to *Payable*.

So **beat 5 must be within five minutes of beat 3.** Shot in order in one session, that is
automatic. If you re-shoot the adviser's book later, the row you just created will say
*Payable* and the four-state shot is gone — subscribe again, or accept three states.

Everything else is fast. Measured on testnet this evening:

| Action | Time |
|---|---|
| Open an account (deploy the wallet) | 5.0s |
| Credit the account | 4.9s |
| Subscribe — build and simulate | 0.7s |
| Subscribe — submit and confirm | 4.7s |
| Any page load (live chain reads) | 0.14–0.51s |

That is why the account is opened **on camera** rather than before it. Ten seconds of real
network is worth more than a pre-baked account.

## Beats — 178 seconds

Word counts are given because the budget is real: at a natural pace you get about 2.5 words
a second, and over-writing a beat is the usual way a three-minute video becomes four.

Beats 3 and 4 are deliberately written to fill their waits. Click, touch the sensor, and
**keep talking while the network works** — the words are timed to land as the result does.
Waiting in silence and then speaking puts both beats ten seconds over.

---

**1 · The problem — 16s · 39 words**

*To camera, or over a title card.*

> "I introduce clients to funds. Every quarter I ask the same four questions. Did they log
> my introduction? When do I get paid? Is the number right? And who else can see my rate?
> Today a fund answers all four from its own records."

*Hold on: the four questions on screen.*

---

**2 · The introduction — 12s · 29 words**

*Calder portal, `/i/CALDER-PR7`.*

> "My client opens the link I sent. Calder reads the code off the attribution contract while
> the page renders — so the adviser's claim to introduce them is checkable, not asserted."

*Hold on: "Raghunathan Family Office has introduced you", and the registered account beside
it.*

---

**3 · Open an account — 26s · 62 words**

*Click **Create a passkey**. Touch ID. Wait ~10s.*

> "No seed phrase, no extension, no cryptocurrency. The key is made in this laptop's secure
> element and never leaves it. Calder deploys a Soroban smart account whose only signer is
> that passkey, and pays the network fee — so the investor never has to buy XLM to buy a
> fund. That is the account opening, complete."

*Hold on: the portfolio, 250,000 USDC available.*

---

**4 · Subscribe — 28s · 68 words**

*Enter 250,000. Click **Confirm with your passkey**.*

> "Before the fingerprint, the screen says exactly what the fingerprint authorises — the
> amount, the fund, and the adviser being credited. A passkey prompt says none of that, so
> this screen has to."

*Touch ID. ~5s.*

> "One signature authorises the whole transaction: the USDC leaving, the units arriving, and
> the attribution to the adviser. There is no state where some of it happened."

*Hold on: "Settled on the network", then the portfolio — 250,000 units.*

---

**5 · The adviser's book — 30s · 73 words**

*Calder portal, `/advisers/CALDER-PR7`. Shot within five minutes of beat 4.*

> "Here is the adviser's book, and nobody sent it to them — it is a public read of the
> contract. The introduction I just made is already on it, vesting. Above it, one settled,
> one reversed because that investor redeemed early, and several payable."

*Point at the payable-basis figure.*

> "That figure is a subscription total, not a commission. Turning it into money needs the
> adviser's rate — and the rate is not on the chain, so this page cannot compute the fee and
> does not pretend to."

*Hold on: the four state pills, and the note under the figure.*

---

**6 · What the chain holds — 26s · 63 words**

*Terminal. One command.*

```sh
stellar contract invoke --id $(grep '^CONTRACT=' .contract-id | cut -d= -f2) \
  --source ir-issuer --network testnet -- get_ledger
```

> "This is every field the contract stores about an introduction. Who introduced whom, how
> much they subscribed, when it vests, whether it has been claimed or reversed. There is no
> fee field. There is no rate field. There is no entry point that accepts one. You cannot
> redact what you never recorded."

*Hold on: one attribution row, fields visible.*

---

**7 · The fund's side — 22s · 54 words**

*Fund console, `:5173/issuer`. Reads only — press nothing.*

> "The fund is the one party that holds every rate, so this is the only screen where fees
> appear at all — each adviser at their own terms. None of those numbers came from the
> chain. The client applies a rate it was configured with, and no adviser's client holds
> anyone's but their own."

*Hold on: two advisers, two different fee columns.*

---

**8 · What is not built — 14s · 35 words**

> "Two things I'd rather you heard from me. Claiming marks an introduction as settled; it
> moves no money. Confidential settlement is real on testnet but runs from a script, against
> a separate deployment. Wiring those together is next."

*Hold on: speaker, or a plain card.*

---

**9 · Close — 4s · 11 words**

> "Four questions. The chain answers three, and never learns the fourth."

---

## What to say about what is real

Say these out loud rather than be asked. Every one of them is already in the repo, and a
judge who finds them after the pitch claimed more is the damage scenario.

- **Attribution, vesting and recovery are on chain**, on the deployed testnet contract
  `CDENXKDNNRLQ7F3C7VI3EWFPJBUMO5L6BDV2CZE6LSCP47G5JUGTPJT4`. The portal reads it live.
- **The passkey wallet is real.** `__check_auth` verifies a WebAuthn assertion with
  `secp256r1_verify` on chain, and 13 host tests cover it. What the video shows — the actual
  secure element — is the one part no automated test reaches.
- **Claiming pays nobody.** `claim` and `settle` mark rows and emit ids. A test asserts the
  introducer's balance is still zero afterwards.
- **No rate is on chain.** Say it exactly that way. The repo does contain demo rates in
  `src/lib/fixtures.ts` for a fictional fund — that is demo data, and the claim is about the
  chain, which is clean and checkable.
- **Confidential settlement is real but separate.** Seven `confidential_transfer` events
  exist on the OpenZeppelin token, none carrying an amount — but they were made by a script
  against a different contract from the one the portal reads. They are two proofs, not one
  pipeline. Do not cut from a UI row to a transfer as though they were linked.
- **The proofs are not zero-knowledge.** The Stellar verifier accepts only non-ZK UltraHonk
  today. The amount is absent from the ledger entry and from the event; the proof itself
  carries no privacy guarantee.
- **The vesting window is 300 seconds here.** It is an `initialise` argument; production
  would be 90 days.
- **It is a placement fee, not a trail.** It settles once, on the subscription basis.

## Shot list

| # | Surface | Action | Hold on |
|---|---|---|---|
| 1 | — | narration | the four questions |
| 2 | :5174 `/i/CALDER-PR7` | nothing | the adviser, resolved on chain |
| 3 | :5174 `/open` | Create a passkey → Touch ID | the portfolio, 250,000 available |
| 4 | :5174 `/subscribe` | 250,000 → Touch ID | "Settled on the network" |
| 5 | :5174 `/advisers/CALDER-PR7` | nothing | the four state pills |
| 6 | terminal | `get_ledger` | one attribution row |
| 7 | :5173 `/issuer` | nothing | two advisers, two fee columns |
| 8 | — | narration | — |
| 9 | — | narration | — |

## If something goes wrong on the take

- **"That passkey has no account here yet."** You signed in with a credential whose wallet
  was never deployed. Use *Create a passkey* instead.
- **"This device already holds a passkey for Calder."** Expected on a re-take. Use *I
  already have an account*, or delete the passkey from the browser's settings.
- **The book shows *Payable* where you wanted *Vesting*.** More than 300 seconds passed
  since the subscribe. Subscribe again and re-shoot beat 5 promptly.
- **A page is slow.** Every render does live chain reads; testnet occasionally takes a
  second. Reload rather than narrate over a blank panel.
- **"We could not reach the network."** A testnet blip during a render. It is a calm branded
  page with a *Try again* button — safe to have on camera, and better than the stack trace
  it used to print. Click it and carry on; the stack is in the server's console.
