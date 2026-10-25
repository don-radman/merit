# DESIGN.md — Merit

*Merit*: value earned through action — credit where credit is due. "On the merits" is
serious and exact in legal and financial use; in everyday speech it is warm and human.
"Introduced via Merit."

The visual and verbal system behind the three screens. Read before touching
`src/styles.css` or writing a string that an investor or a scout will see.

## Posture

A good fund administrator, not a crypto startup. Calm surfaces, one deep accent, numbers
that line up, and motion spent on exactly two moments: a row arriving on the book, and a fee
being paid. The audience is new to web3; nothing should look like a wallet.

Anchored on the money-UI discipline of Stripe-style systems (tabular figures, hairline
borders, small radii, one accent), with three borrowed habits: one strong button per view,
status as word + shape + colour (never colour alone), and sentence-case labels.

## Colour

Tokens live on `:root` in `src/styles.css`; dark mode redefines them under
`prefers-color-scheme: dark`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f4f6f8` | `#0e1218` | page |
| `--surface` | `#ffffff` | `#151b24` | cards |
| `--surface-2` | `#eceff3` | `#1b2330` | stat tiles, table head, segmented control |
| `--fg` | `#141d2d` | `#e8edf4` | text |
| `--muted` | `#5b6678` | `#96a2b4` | secondary text (≥ 4.5:1 on surface) |
| `--accent` | `#0d5f66` harbour teal | `#5fc2c9` | the one accent: primary button, Ready state, links |
| `--line-input` | `rgba(20,29,45,.46)` | `rgba(226,232,240,.42)` | form and secondary-button borders (≥ 3:1, WCAG 1.4.11) |

Status is a small family, each a text colour on a soft tint of itself:

| State | Word | Shape | Colour |
|---|---|---|---|
| vesting | Vesting | clock | `--warn` amber |
| claimable | Ready | dot | `--accent` |
| claimed | Paid | check | `--ok` green |
| recovered | Reversed | undo arrow | `--neutral` grey, amount struck through |

Never a purple-to-blue gradient, never Tailwind indigo, never a coloured left border.

## Type

- **Display:** IBM Plex Serif 500 — `h1` and the holdings hero figure only. The voice of a
  statement.
- **Body:** IBM Plex Sans 400/500/600. 15.5px / 1.55.
- **Mono:** IBM Plex Mono — codes (`CALDER-PR7`), references, the share link.
- Scale: 12 (eyebrow) · 13.5 (small) · 15.5 (body) · 18 (h2) · 24–32 (h1) · 22–28 (stat).
- Every number: `font-variant-numeric: tabular-nums`. Every amount: `US$`, two decimals,
  via `formatUsd` — a bare `$` means SGD, AUD or NZD to this audience.
- Loaded from Google Fonts with a system fallback; self-host as woff2 before the venue.

## Space and shape

- 4px grid. Card padding 22/24. Row height ≥ 60px. Page max 600 (investor) / 1040 (wide).
- Radii: 6 (small controls) · 10 (buttons, inputs, tiles) · 14 (cards) · 999 (pills).
- Cards carry a hairline border and `--shadow-1` only. Stat tiles have no border — they sit
  on `--surface-2`. No cards inside cards.

## Motion

- `--ease-out: cubic-bezier(.2,.8,.2,1)`; 120ms (hover) · 220ms (state) · 420ms (arrival).
- The two authored moments: `row-in` (a new introduction eases in from 4px above,
  staggered 45ms by index) and the pill colour transition when a state changes.
- Nothing bounces. No `transition: all`. `prefers-reduced-motion` collapses every animation
  except a slowed spinner.

## Components

- **Stat tile** — one label, one number, one hint. `locked` adds the small lock that marks
  a figure as confidential. The "On its way" tile takes the accent; the other two do not.
- **Status pill** — `StatusPill` maps the four on-chain states to the scout's words. Never
  show `claimable` or `recovered` to a human.
- **Rows** — a CSS-grid table that stacks on phones with `data-label` prefixes. Reversed
  rows go muted with the fee struck through; they stay on the book as evidence.
- **Segmented** — "Your view / What the world sees". Toggle buttons with `aria-pressed`.
- **Toast** — quiet confirmations only, bottom centre, polite live region. Errors are
  banners in place, where the user is looking, and every money error says whether money
  moved.
- **Buttons** — one filled primary per view. Loading keeps the label and adds a spinner.
  Secondary is bordered; ghost is for the demo bar.
- **Skeletons** mirror the shape they replace so nothing jumps.

## Voice

Plain, warm, exact. Short sentences. Sentence case. No exclamation marks.

Words that never appear on an investor or scout screen: *wallet, gas, seed phrase,
trustless, anonymous, on-chain, blockchain, token, mint, trustline, hash, USDC* (say
"US dollars"). Allowed and used on purpose: *account, Face ID, recorded, verified, private,
Stellar* (once, as reassurance in the footer).

Every button is a verb plus an object: *Create account · Check my details · Subscribe
US$250,000 · Copy link · Set up payouts · Collect now · Run payout.*

Every screen has one number that matters. Investor: *You hold 250,000 units.* Scout:
*US$1,250 received — private.* Fund: *Fee liability · 1 to settle.*

## Pre-ship checklist

- [ ] 2px visible focus ring on everything focusable, in both themes
- [ ] Contrast: text ≥ 4.5:1, input borders ≥ 3:1, checked not eyeballed
- [ ] Reduced motion respected; nothing pulses or bounces
- [ ] Every data region has empty, loading, error and populated states
- [ ] No emoji, no text glyphs as icons
- [ ] Phone-verified at 390px: no horizontal scroll, inputs ≥ 16px
- [ ] Banned-word grep on the investor and scout screens is clean
- [ ] Totals reconcile on screen (Earned = On its way + Paid out)
