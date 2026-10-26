# DESIGN.md — Merit

*Merit*: value earned through action — credit where credit is due. "On the merits" is
serious and exact in legal and financial use; in everyday speech it is warm and human.
"Introduced via Merit."

The visual and verbal system behind the four screens, as built. The identity itself is
**Merit / Peak Signal v1.0** in [`docs/brand`](./docs/brand) (brandbook PDF, text, tokens,
master SVGs); this file is how that identity lands in `src/styles.css`. Read both before
touching the stylesheet or writing a string an investor or an adviser will see.

## Posture

Premium is precision. Steel first, citron as a signal. Calm surfaces, hairline dividers
rather than boxes, exact figures that line up, and motion spent on exactly two moments: a
row arriving on the book, and a fee being paid. The audience is new to web3; nothing should
look like a wallet.

Three habits from money-UI systems: one strong button per view, status as word + shape +
colour (never colour alone), and sentence-case labels.

**Brand hierarchy.** The client's brand in investor flows, Merit in adviser and fund
operations. `Shell brand="fund"` adds `.shell--fund`, which scopes Calder's tokens (deep
green, serif) over the same components. Calder is fictional; a real client portal inherits
its manager's identity the same way.

## Colour

Brand primitives sit on `:root` as `--merit-*` and are never used by components directly.
Components read the semantic set; dark mode redefines it under `prefers-color-scheme: dark`
(guarded for an explicit host `data-theme`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | bone `#f4f2e9` | graphite `#202626` | page |
| `--surface` | `#fcfbf7` | `#2a3030` | cards |
| `--surface-2` | `#ecede6` | `#333a3a` | stat tiles, table head, segmented control, quiet notes |
| `--surface-3` | stone `#daddd3` | `#3d4545` | pressed / active |
| `--fg` | graphite `#202626` | bone `#f4f2e9` | text (13.7:1) |
| `--muted` | `#5e6868` | steel `#b8bfc0` | secondary text (5.1:1 / 8.2:1) |
| `--line-input` | `#748080` | `#8a9394` | essential control borders (≥ 3:1) |
| `--accent` | citron `#d7f45b` | citron | a **fill** with graphite on it: the primary button, the Payable state |
| `--accent-ink` | olive `#697557` | citron | an accent for large text only (the focal stat value) |
| `--inverse-bg` | graphite | `#2e3535` | the one emphasised card a screen may use (`.card--inverse`, `.card--accent`) |
| `--focus` | graphite | citron | 2px ring, 2px offset |

Citron and steel are never small text on bone. Aim for roughly 80% graphite/bone, 15%
steel/stone, 5% citron on any composition.

Status is semantic and separate from the brand primitives (brandbook p.19):

| State | Word | Shape | Light | Dark |
|---|---|---|---|---|
| vesting | Vesting | clock | `#805600` on `#fff2cc` | `#f0c75e` on 14% |
| claimable | Payable | square | graphite on citron | citron on 14% |
| claimed | Paid | check | `#20563b` on `#e5f2e9` | `#8fd9b0` on 14% |
| recovered | Reversed | undo, amount struck through | `#5e6868` on `#ecefea` | steel on 12% |
| error | — | — | `#9d2f25` on `#fdece8` | `#f2a49d` on 14% |

Never a gradient on the flat mark, never a shadow in a product header, never a coloured
left border on a card.

## The mark

`MeritMark` in `src/components/icons.tsx` inlines the master path with its viewBox cropped
to the visible 82×80 bounds, so `size` is the visible height the brandbook measures. Full
snowcap mark at 32px and above (the header); the micro mark without the cut below that
(the front-page footer at 20px, `public/favicon.svg` at 16px). Clear space is H/4; the 8px
gap in `.brand` and the header padding provide it. Graphite on bone, bone on graphite;
citron only as an occasional emphasis. Never stretched, rotated or outlined.

## Type

- **Display:** Manrope 700 for `h1`/`h2`, 800 for the wordmark and the front-page hero.
- **Body:** Inter 400/500/600. 16px / 1.5.
- **Money:** Inter 600, `font-variant-numeric: tabular-nums lining-nums`, no letter
  spacing. Every amount is `US$`, two decimals, via `formatUsd` — a bare `$` means SGD,
  AUD or NZD to this audience.
- **References:** IBM Plex Mono for codes (`CALDER-PR7`), the share link, eyebrows and
  table heads (uppercase, 0.06em).
- Scale: 12 (label/eyebrow) · 13.5 (small) · 16 (body) · 20 (section) · 26–32 (page
  title) · 22–28 (stat) · 38–64 (front-page display, 1.05).
- Self-hosted latin woff2 in `public/fonts` (OFL licences alongside). Preload only the
  primary face.
- The client scope swaps `--font-display` for a serif so Calder never reads as Merit.

## Space and shape

- 8px rhythm (4px for small internal adjustments). Card padding 22/24. Row height ≥ 60px.
  Page max 600 (investor) / 1040 (wide).
- Radii: 6 (controls, pills, inputs, buttons) · 10 (cards, tiles).
- Cards carry a hairline border and no shadow. Stat tiles have no border — they sit on
  `--surface-2`; the focal tile takes a 3px citron rule, not a fill. No cards inside cards.
- `.rule` is the brand's short citron bar, once per composition, under a headline.

## Motion

- `--ease-out: cubic-bezier(.2,.8,.2,1)`; 120ms (hover) · 220ms (state) · 420ms (arrival).
- The two authored moments: `row-in` (a new introduction eases in from 4px above,
  staggered 45ms by index) and the pill colour transition when a state changes.
- Nothing bounces, nothing pulses around money. No `transition: all`.
  `prefers-reduced-motion` collapses every animation except a slowed spinner.

## Components

- **Stat tile** — one label, one number, one hint. `locked` adds the small lock that marks
  a figure as confidential. The "On its way" tile takes the accent rule; the other two do not.
- **Status pill** — `StatusPill` maps the four on-chain states to the adviser's words. Never
  show `claimable` or `recovered` to a human.
- **Rows** — a CSS-grid table that stacks on phones with `data-label` prefixes. Reversed
  rows go muted with the fee struck through; they stay on the book as evidence.
- **Segmented** — "Your view / What the world sees". Toggle buttons with `aria-pressed`.
  The public view keeps the same layout and row order; fees become dots. It is an
  explanation, not access control.
- **Toast** — quiet confirmations only, bottom centre, polite live region. Errors are
  banners in place, where the user is looking, and every money error says whether money
  moved.
- **Buttons** — one filled primary per view. Loading keeps the label and adds a spinner.
  Secondary is bordered; ghost is for the demo bar.
- **Skeletons** mirror the shape they replace so nothing jumps.
- **Front page** (`Home.tsx`) — one message per section: who it is for, four steps, Merit
  Connect (the inverse card), what is underneath, and the demo boundary in the footer.

## Voice

Plain, warm, exact. Short sentences. Sentence case. No exclamation marks. Confidence from
precision, not superlatives: *Your introduction is recorded.* · *US$1,250.00 is payable.* ·
*Your rate is between you and the fund.* · *Payout not sent. No money moved.*

Words that never appear on an investor or adviser screen: *wallet, gas, seed phrase,
trustless, anonymous, on-chain, blockchain, token, mint, trustline, hash, USDC* (say
"US dollars"). Allowed and used on purpose: *account, Face ID, recorded, verified, private,
Stellar* (once, as reassurance in the footer). Use *adviser, introduction, book, placement
fee, vesting, payable, paid, reversed*.

Every button is a verb plus an object: *Create account · Check my details · Subscribe
US$250,000 · Copy link · Set up payouts · Collect now · Run payout.*

Every screen has one number that matters. Investor: *You hold 250,000 units.* Adviser:
*US$1,250.00 is payable.* Fund: *Payable now · 1 to settle.*

## Claims

Label testnet, the fictional fund and illustrative data. Keep stub and live distinct. A
simulated button is not a settlement service; rate privacy is not "everything is private".
Say *Recorded on Stellar* where accurate; imply no approval, certification or sponsorship.

## Pre-ship checklist

- [ ] 2px visible focus ring on everything focusable, in both themes
- [ ] Contrast: text ≥ 4.5:1, input borders ≥ 3:1, checked not eyeballed
- [ ] Reduced motion respected; nothing pulses or bounces
- [ ] Every data region has empty, loading, error and populated states
- [ ] No emoji, no text glyphs as icons
- [ ] Phone-verified at 390px: no horizontal scroll, inputs ≥ 16px
- [ ] Banned-word grep on the investor and adviser screens is clean
- [ ] Totals reconcile on screen (Earned = On its way + Paid out)
- [ ] The mark is never below 32px with its cut, never stretched
