# Merit — brand brief

Everything decided so far about what Merit is, who it is for, how it speaks and how it
currently looks. Written as the hand-off for building the visual identity: the
brandbook should start from this, not re-derive it.

Three brands appear in the demo and must never blur:

| | What it is | Who owns it |
|---|---|---|
| **Merit** | the product — attribution and private payouts for whoever brings an investor to a tokenized fund | us; this document |
| **Calder** | a *fictional* Singapore fund manager, the demo's client; the investor portal is branded Calder because an investor is buying Calder units through someone they trust | the demo; `site/src/brand.css` |
| **Co/Unity** | the company that designs and runs introducer and advocate programmes around Merit | existing brand book (navy, Montserrat, colour as a glint) |

Merit is a product with its own name. Co/Unity wraps services around it. Calder is a prop.

---

## 1. The name

**Merit.** Value earned through action — credit where credit is due. In legal and
financial use ("on the merits") it is serious and exact; in everyday speech it is warm and
human. Short, crisp, universally positive.

- **Tagline:** *Credit where it's due.*
- **How it appears in a sentence:** *Introduced via Merit.* · *Recorded on Merit.* ·
  *Paid through Merit.*
- **Never:** "Merit Protocol", "MeritFi", "Merit Rails", "$MERIT". It is a product, not a
  token or a chain.
- **Working / repo name:** Introducer Rails. Stays on the repo; does not appear on screen.
- **Domains open at time of writing:** merit.xyz, usemerit.com, meritrails.com,
  viamerit.xyz. "Merit" is a crowded trademark space (a credentials company, a
  medical-devices company), so the company would likely live at usemerit.com.

### The role word

The people Merit pays are **advisers** on screen — wealth advisers, relationship managers,
family-office partners, placement agents, introducers. One word, chosen to match the
Calder portal so the two surfaces never disagree on camera. Internally and in the
community/ambassador mode we have called them **scouts** — the one who finds and brings.
The brandbook can keep "scout" as the spirit of the role (it is the better word for a
mark or a mascot) while the product says "adviser".

---

## 2. Why we exist

**One sentence.** So the person who brought the investor never has to wonder whether
they are in the deal, or when they will be paid.

**Mission.** Give tokenized fund issuers and the people who distribute for them a shared,
confidential settlement layer on Stellar: attribution written on-chain, terms kept between
the parties, totals provable to an auditor.

**Vision.** A world where every introduction that creates value is recorded the moment it
is made, honoured on time, and paid in private — and where "trust me, the spreadsheet's
right" is no longer how distributors get paid.

**The problem, in the adviser's words.** "I introduce clients to funds. Every quarter I ask
the same four questions. *Did they log my introduction? When do I get paid? Is the number
right? And who else can see my rate?* Today a fund answers all four from its own records."

**The claim, in one line.** *The introduction is public. The rate is not.*

---

## 3. Who it is for

| Audience | Role in the story | What they need to feel |
|---|---|---|
| **The adviser / scout** | the protagonist; the person who feels the pain | *I'm in the deal. I never chase. I can check it myself. My rate is my business.* |
| **The fund manager (issuer)** | the buyer; a Conduit-type tokenized-fund operator | control (approve, freeze, recover), no reconciliation, no rate leaks between distributors |
| **The investor (HNW client)** | the proof that an adviser's client will not bounce; often new to web3 | a fund site, not a crypto app; Face ID, plain English, no new words |
| **The auditor** | the one who makes it allowable | a key that opens every settlement without any position being public |

**Markets:** Singapore and Hong Kong first (trailer fees legal with disclosure; MAS has an
"introducer" regime that Merit matches by construction — the adviser never touches client
money), wholesale Australia and New Zealand next. Never retail in AU/UK/EU; never
unregistered finders in the US. The allowlist is the compliance perimeter.

**Web3 literacy of the audience: assume none.** The adviser is a professional in
their fifties with a book of clients. The investor is their client. Nothing on an adviser
or investor screen should look like a wallet.

---

## 4. The feeling

The brand is the emotional end-state of a referral that just worked:

- **Connected** — you brought someone in and your name is on it.
- **Counted** — the record was written by the same transaction that moved the money;
  nobody has to remember you.
- **Compensated fairly** — paid on a known date, at your terms, with nobody owing anybody.
- **Calm** — nothing to chase, nothing to check, nothing to explain.

Not: hidden, hush, trustless, disruptive, anonymous. Merit is **confidential, not
anonymous**: the parties know each other; the numbers stay between them.

### Core values — in the adviser's voice

1. **You're always in the deal.** Your name is written by the same transaction that moves
   the money.
2. **You never chase.** Payment lands on a known date, automatically.
3. **You can check it yourself.** Every introduction is on a public ledger you don't have
   to trust anyone to read.
4. **Your deal is your business.** Your rate and your payout are between you and the fund.
5. **It works like the web you already use.** A link, a book, Face ID. No wallets, no seed
   phrases, no gas, no new words.
6. **Fair both ways.** The fund keeps its protections — vesting, reversal if a client exits
   early, an auditor who can verify totals — so it can say yes to paying you faster.

### Operating principles — the ones you can grep for

1. The rate never touches the chain.
2. The adviser never touches client money.
3. Compose audited primitives; never author cryptography.
4. Every private number has an auditor channel.
5. A fee vests before it is paid, and the fund can recover it before it vests.
6. The allowlist is the compliance perimeter.
7. Claim only what the code does — measured, not assumed.

---

## 5. Voice

**Posture:** a good fund administrator, not a crypto startup. Plain, warm, exact. Short
sentences. Sentence case. No exclamation marks. Candour before anyone asks — every caveat
is said out loud in the README, the demo and the deck.

**Words we own:** introduction · adviser · book · placement fee · vesting · payable · paid ·
reversed · recorded · verified · private · settlement.

**Words that never appear on an adviser or investor screen:** wallet, gas, seed phrase,
trustless, anonymous, on-chain, blockchain, token, mint, trustline, hash, USDC (say "US
dollars"). *Stellar* appears once per screen, in the footer, as reassurance: *Recorded on
Stellar.*

**Buttons are verb + object:** Create account · Check my details · Subscribe US$250,000 ·
Copy link · Set up payouts · Collect now · Run payout.

**Money:** always `US$`, two decimals, tabular figures. A bare `$` means SGD, AUD or NZD to
this audience.

**One number per screen.** Investor: *You hold 250,000 units.* Adviser: *US$1,250 received —
private.* Fund: *Fee liability · 1 to settle.*

**Status words, on every row:** Vesting · Payable · Paid · Reversed. Never the chain's
names (claimable, recovered).

**Boilerplate.**
- *Short:* Merit pays the people who bring investors to tokenized funds — automatically,
  privately, and on the record.
- *Medium:* Merit is attribution and private payouts for fund distribution on Stellar. When
  an investor subscribes through an adviser's link, the introduction is recorded by the
  same transaction that moves the money; the adviser's fee vests, pays on a known date, and
  settles confidentially so no distributor ever learns another's terms. Credit where it's
  due.
- *Positioning against the obvious comparison:* referral and affiliate engines run public
  campaigns for growth teams. Merit runs regulated fund distribution: private terms,
  vesting with chargeback, issuer controls, an auditor key. Different buyer, different
  problem.

---

## 6. The visual direction as built

This is what exists today in `src/styles.css` and `DESIGN.md`. It is a competent first
pass, not a decision — the brandbook should confirm, replace or refine it.

**Posture.** Calm surfaces, one deep accent, numbers that line up, motion spent on two
moments only (a row arriving on the book; a fee being paid). Anchored on the money-UI
discipline of Stripe-style systems: tabular figures, hairline borders, small radii, one
accent, one strong button per view, status as word + shape + colour.

**Colour.**

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#f4f6f8` | `#0e1218` | page |
| surface | `#ffffff` | `#151b24` | cards |
| surface-2 | `#eceff3` | `#1b2330` | stat tiles, table head |
| ink | `#141d2d` | `#e8edf4` | text |
| muted | `#5b6678` | `#96a2b4` | secondary text |
| **accent — "harbour teal"** | `#0d5f66` | `#5fc2c9` | the one accent: primary button, Payable state, links |

Status family (text on a soft tint of itself): Vesting = amber `#9a6700` · Payable = the
accent · Paid = green `#15803d` · Reversed = grey `#667085` with the amount struck through.
Error `#b42318`.

An alternative that a design-guidelines review recommended and we did not take: Stripe-blue
`#1F5F8B` ("ledger blue") as the accent. Both pass the same contrast rules. **The brandbook
decides.**

**Type.** IBM Plex Serif 500 for display (`h1`, the holdings hero figure — "the voice of a
statement"); IBM Plex Sans 400/500/600 for everything read; IBM Plex Mono for codes
(`CALDER-PR7`), references and the share link. Self-hosted. Alternative not taken:
Schibsted Grotesk + Public Sans. **The brandbook decides.** Whatever it picks must have
tabular figures.

**Shape.** 4px grid. Radii 6 / 10 / 14 / pill. Cards: hairline border + one soft shadow.
Stat tiles: no border, on surface-2. No cards inside cards. No coloured left borders, no
purple-to-blue gradients, no indigo.

**Motion.** `cubic-bezier(.2,.8,.2,1)`; 120 ms hover, 220 ms state, 420 ms arrival. A new
introduction eases in from 4 px above, staggered 45 ms per row. Pills cross-fade colour on
state change. Nothing bounces. Reduced-motion collapses everything but a slowed spinner.

**Mark.** Today a placeholder: an 18 px rounded square with a teal gradient next to the
wordmark. **The brandbook's first job.** Directions worth exploring from the name and the
feeling: a tick inside a seal (credit, verified); a byline rule (the line under a name);
two marks joined (the introduction); a scout's compass or pointer (the one who finds); the
"nod". Avoid: chains, blocks, hexagons, padlocks, shields with keyholes, anything that
says crypto or secrecy.

**Iconography.** Lucide line icons, 2 px stroke, 16 px inline with text. Never emoji.

---

## 7. The product surfaces

| Surface | Who sees it | Branded as | What it shows |
|---|---|---|---|
| **Adviser's book** (`/scout` on the fund console; `/advisers/<CODE>` on the Calder portal) | the adviser | Merit | share link · Earned / On its way / Paid out · one row per introduction with status · **"What the world sees"** toggle that re-renders the screen as the public record (fees become dots) · one-time *Set up payouts* · optional *Collect now* |
| **Fund console** (`/issuer`) | the fund manager | Merit (header says the fund) | ledger with each adviser's fee at *that* adviser's private rate · *Run payout* · reconciliation |
| **Investor flow** (`/i/<CODE>` on the Calder portal) | the investor | **Calder** | the adviser who introduced them, resolved on chain · create a passkey · subscribe with one fingerprint · portfolio · wallet |

Screenshots: `docs/screenshots/scout.png`, `scout-public-view.png`, `scout-dark.png`,
`scout-setup.png`, `fund-console.png`, `investor-phone.png`, `investor-done.png`, and the
Calder portal in `calder-*.jpg`.

**The signature image of the brand** is the adviser's book with the toggle flipped: her
fees as dots, the banner saying *Not your rate. Not what you are paid.* Privacy made
visible on her own screen rather than asserted on a slide. Every piece of brand material
should be able to show that one frame.

---

## 8. The story the brand tells (the demo, in brand terms)

Nine beats, 178 seconds, one adviser as narrator. The arc is the four questions, each
killed by one beat:

1. *The problem* — four questions, to camera.
2. *The introduction* — the client opens the adviser's link; the adviser's claim to have
   introduced them is checkable on chain, not asserted.
3. *Open an account* — one fingerprint, no seed phrase, no extension, no cryptocurrency;
   the fund pays the network fee.
4. *Subscribe* — the screen says exactly what the fingerprint authorises; one signature,
   whole transaction, no half-states.
5. *The adviser's book* — the introduction is already there, vesting; a public read; the
   payable figure is a basis, not a commission, because the rate is not on the chain.
6. *What the chain holds* — every field, no fee, no rate, no entry point that accepts one.
   *You cannot redact what you never recorded.*
7. *The fund's side* — the one party that holds every rate; two advisers, two different fee
   columns, none of it from the chain.
8. *What is not built* — said plainly.
9. *Close* — "Four questions. The chain answers three, and never learns the fourth."

---

## 9. Platform and partners, for the "powered by" line

- **Stellar** — the network. The regulated-asset controls (authorise, freeze, recover) and
  the passkey smart account are native to it.
- **OpenZeppelin** — the confidential token (audited, released 20 Oct 2026) and the smart
  account library. "Compose audited primitives; never author cryptography."
- **HackMeridian 2026**, Lisbon — tracks *Stellar Unlocked* and *Stellar Composed*.

---

## 10. What the brandbook has to decide

1. Wordmark and mark (see §6 *Mark*).
2. Accent: harbour teal (as built) or ledger blue.
3. Type: Plex Serif + Sans (as built) or a grotesk pairing. Must have tabular figures.
4. Whether "scout" survives as the spirit of the role in illustration, naming of tiers, or
   the community/ambassador mode, while the product says "adviser".
5. Imagery: none today. If any — real people and real places (Singapore, Lisbon), never
   abstract networks, nodes or glowing lines.
6. How Merit and Co/Unity sit together on a slide (Co/Unity navy + Montserrat is a
   different system; Merit should not inherit it).
7. The relationship to Calder on screen: Merit is never visible to the investor; is a
   small "via Merit" line on the investor's statement allowed, or not?
