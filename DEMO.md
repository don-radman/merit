# Demo walkthrough

One protagonist, one screen, two inserts. About two and a quarter minutes.

The scout is the narrator because the scout is the person who feels the problem. The fund
is the buyer and gets ten seconds. The investor is the proof that a scout's client will not
bounce, and gets twenty-five.

## Setup

```bash
npm run dev                      # stub mode: everything is in-memory and instant to reset
# or, against the seeded testnet deployment (reads are real, writes still stub):
VITE_CLIENT_MODE=live npm run dev
```

Open **two windows** side by side:

| Window | URL | What it shows |
|---|---|---|
| Left, phone-sized | `http://localhost:5173/i/CALDER-PR7?frame=phone` | the investor, in a phone frame |
| Right, full | `http://localhost:5173/scout` | the scout's book |

The stub mirrors itself across tabs through `localStorage`, so when the investor finishes
on the left, the row appears on the right without a refresh. That is beat 4.

The **demo bar** at the bottom (dev builds only) has every lever you need between takes:
**Reset** (back to seed), **Vest all** (pretend the window has passed), **Show setup** (put
the one-time payout card back), **Fail next** (arm an error state), and jumps to every
screen.

## The four questions

The whole demo is four questions a scout asks every quarter, each killed by one beat:

1. Did they log my introduction?
2. When do I get paid?
3. Is the number right?
4. Who else can see my rate?

## Beats

**0 · The problem — 15s.** To camera. "I introduce clients to funds. Today I'm paid by
invoice, ninety days late, and I never know if the number is right — and my rate sits in a
spreadsheet everyone on the deal can read." Then the four questions, fast.

**1 · Set up once — 10s.** Scout window, after **Show setup**. The card: *Set up payouts —
one Face ID, you won't be asked again, like adding a bank account to any referral
programme.* Click it. Toast: *Payouts set up.*
*Behind it: the scout's confidential account is registered. They never see that word.*

**2 · Share — 5s.** **Copy link.** "I send it like I'd send a calendar link."

**3 · Tom invests — 25s.** Phone window. *Create your account* → Face ID → *Confirm who
you are* → **Calder is approving your account** (the one visible wait) → *Invest
US$250,000* → *You are invested. 250,000 units. Introduced by Raghunathan Family Office.*
Four steps. No wallet, no gas, no jargon.
*Value: her clients will not bounce.*

**4 · She's in the deal, instantly — 15s.** Cut to the scout window. The row is already
there: *T. Lindqvist · Singapore · US$250,000 · Your fee US$1,250 · Vesting · pays 23 Jan.*
Nobody clicked anything.
*Question 1 answered: the same transaction that took Tom's money wrote her name on it.*

**5 · What the world sees — 15s.** Flip the toggle. Fees become dots; the banner says what
the chain holds: *that she introduced each investor, how much, and whether it has vested,
paid or reversed. Not your rate. Not what you are paid.* Flip back.
*Question 4 answered. This is the privacy moment, and it lives on her screen.*

**6 · Pays on a date, not "eventually" — 10s.** Point at a *Vesting · pays 23 Jan* pill.
"Unless Tom redeems early, in which case it's reversed — the same terms as today's
agreements, with nobody invoicing anybody." Point at the *Reversed* row as the example.
*Question 2 answered.*

**7 · Payout — 15s.** Fund window (`/issuer`). **Vest all** from the demo bar if needed.
*Ready to pay · 1 introduction · 1 scout.* Click **Run payout**. *Proving and settling…*
Toast: *Paid 1 scout privately.* Cut back to the scout: the pill is **Paid**, the *Paid
out* tile has moved.
*Question 3 answered: and the auditor line below says the number reconciles.*

**8 · The fund's side — 10s.** Stay on `/issuer`. "One click, every scout, each at their own
rate. No spreadsheet. The auditor reconciles the total without seeing any scout's rate."

**9 · Close — 15s.** "Four questions. Zero asked." Why now: OpenZeppelin's Confidential
Token, audited and mainnet-ready, released this week — this could not be built on Stellar
before 20 October 2026. Who asked: two client calls, anonymised. Next: confidential
holdings, pro-rata chargeback, trail fees on the same rails.

## What to say about what is real

- **Attribution, vesting, recovery and the four states are on chain**, on the seeded
  testnet deployment (`VITE_CLIENT_MODE=live` reads it).
- **Confidential settlement is real on chain** through OpenZeppelin's token, driven today
  from `scripts/confidential.sh`. The UI's **Run payout** button is the stub; wiring it to
  that script is the next integration step.
- **The investor's account is a stub.** The passkey smart wallet is the piece of work
  still open.
- **The chain never holds a rate or a fee.** `scripts/e2e-testnet.sh` fails the build if it
  ever does.

Say all four out loud in the video rather than be asked.

## Shot list

| # | Window | Action | Hold on |
|---|---|---|---|
| 0 | — | narration | — |
| 1 | scout | Show setup → Set up payouts | the toast |
| 2 | scout | Copy link | the tick on the button |
| 3 | phone | the five steps | *You are invested* |
| 4 | scout | nothing | the new row easing in |
| 5 | scout | toggle | the dots + banner, three seconds |
| 6 | scout | hover a Vesting pill | the date |
| 7 | fund → scout | Run payout | the pill turning Paid |
| 8 | fund | nothing | Reconciles |
| 9 | — | narration | — |
