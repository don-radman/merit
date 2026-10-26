# Working in this repository

Merit: confidential attribution and private placement-fee payouts for advisers who bring
investors to tokenized funds on Stellar. Two toolchains, one repo, no monorepo tooling
(DECISIONS.md D8). Start with README.md, then docs/ARCHITECTURE.md.

## Layout

| Path | What it is | Toolchain |
|---|---|---|
| `contracts/introducer-rails/` | The attribution contract: `subscribe`, `claim`, `settle`, `recover`, `get_book`, `get_ledger`. Stores no rate and no fee. | cargo (Soroban, `#![no_std]`) |
| `contracts/passkey-wallet/` | The investor's smart account: `__check_auth` verifies a WebAuthn assertion with `secp256r1_verify`. | cargo (Soroban) |
| `src/` | Merit's own screens: the adviser's book, the fund's attribution ledger and payout run, the investor flow. Talks only to `src/lib/`. | npm / Vite / React |
| `src/lib/` | The frozen client interface (`types.ts`), the stub client, the live RPC client. | npm |
| `site/` | The Calder portal: a fictional fund manager's investor portal with passkey accounts and a fee relayer. Its own Vite project. | node + Vite |
| `scripts/` | Testnet deploy, seed, e2e, confidential settlement, smoke and demo QA. | node + Stellar CLI |
| `docs/` | Architecture, the parts of Stellar used, go-to-market, brand kit, the interactive architecture map. | |

## Build and test

```sh
npm install
npm run typecheck                 # tsc --noEmit
npm run build                     # tsc + vite build
npm run smoke                     # the stub client against its contract (78 checks)
VITE_DEMO_BAR=1 npx vite build && node scripts/qa-demo.cjs dist /tmp/shots   # Playwright, 30 checks
cargo test                        # both contracts, host-side (23 tests)
./scripts/check-secrets.sh        # the repo hands over no live rate
```

Contracts build to WASM with `stellar contract build` (needs the `wasm32v1-none` target and
Rust 1.84 or newer). Do not substitute `cargo build --target wasm32v1-none`.

## Rules

- Never commit `contracts/rates.json`, `contracts/.conf-state`, `.stellar/` or any secret key.
  `scripts/check-secrets.sh` enforces the first; the others are gitignored.
- The chain never learns a rate. A change that puts a rate or a fee on a ledger row or in an
  event is wrong by construction; read the header of `contracts/introducer-rails/src/lib.rs`.
- `src/lib/types.ts` is shared and frozen: a signature change is a conversation first.
- Generated bindings in `src/bindings/` are committed so the UI builds without Rust.
- `site/` is Calder-branded on purpose; Merit's identity (docs/brand) stays out of it.
