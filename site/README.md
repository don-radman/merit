# Calder — the investor portal

A server-rendered site for a fictional Singapore fund manager that distributes its fund
through introducers, settles on Stellar, and gives every investor a wallet whose only
credential is a passkey.

It exists to answer the question the contract on its own cannot: *what does this actually
look like to the person using it?* The answer is that it looks like a fund site, and the
blockchain is almost invisible — no seed phrase, no extension, no XLM, no gas.

**Calder does not exist.** The manager, the fund, the licence number and the ISIN are all
invented, every page says so, and the money is testnet money.

## Run it

```sh
node scripts/site-setup.mjs   # once: generates the site's key, funds it, adds a trustline
npm run site:dev              # http://localhost:5174
```

`site-setup.mjs` prints a `stellar contract invoke` line to mint the testnet USDC float to
the site's address. Run that once and the site can credit new accounts.

Production:

```sh
npm run site:build && npm run site:start
```

## What an investor does

1. Opens an adviser's link, `/i/CALDER-PR7`. The code is resolved **on chain** during the
   request, so the adviser's claim to introduce them is checkable rather than asserted.
2. Creates a passkey. Calder deploys a Soroban smart account whose only signer is that
   credential and pays for it.
3. Subscribes. One fingerprint authorises the whole transaction — USDC out, fund units in,
   attribution to the adviser — so there is no state where some of it happened.
4. Manages the account: balances, send, receive, recent activity, and adding or revoking
   devices.

Meanwhile `/advisers/<CODE>` is the adviser's book, read live, showing every introduction
and its state. What it deliberately cannot show is the commission: no rate is on the chain,
so the site has nothing to multiply by and does not pretend otherwise.

## Shape

```
site/
  server.mjs            express; vite in middleware mode for dev, prebuilt bundles for prod
  server/
    config.mjs          contract ids from .contract-id, the one key from .env.local
    chain.mjs           every read: balances, book, ledger, activity
    relayer.mjs         wallet deployment, and the two-phase passkey signing pipeline
    api.mjs             the HTTP surface
    loaders.mjs         what each page needs, loaded before render
  src/
    entry-server.tsx    renderToString
    entry-client.tsx    hydrate, then client-side navigation against /api/page
    wallet/
      passkey.ts        the browser's whole job: create, sign, and nothing else
      webauthn-sig.mjs  DER -> 64-byte low-S, SPKI -> raw point. Shared with Node.
    pages/              public.tsx (anyone) and account.tsx (an investor)
```

Plain `.mjs` on the server so Node runs it with no build step, `.tsx` for anything React
renders. `webauthn-sig.mjs` is deliberately dependency-free ESM because the browser and the
Node test harness both import the same file — the signature conversion is the fiddliest part
of this and two copies of it would drift.

## Why signing takes two round trips

A passkey does not sign the transaction. It signs the 32-byte Soroban authorization payload,
which is derived from the invocation tree, a nonce the network picks, the network id and an
expiry ledger — and that payload only exists after simulation.

So `prepare` builds the call, simulates it and returns the payload as the WebAuthn
challenge; the browser gets an assertion; `submit` puts it into the same authorization entry,
re-simulates to prove the wallet accepts it, and sends it. Re-simulating is the point:
`__check_auth` runs during simulation, so a bad assertion fails before a fee is spent and
with an error worth showing.

## Proving it works

```sh
cargo test -p passkey-wallet   # 13 host tests, real P-256 signatures
npm run site:e2e               # the whole flow against testnet
```

`site-e2e.mjs` substitutes a simulated authenticator that produces byte-identical payloads to
a browser's — same `authenticatorData` layout, same `clientDataJSON`, same DER signature over
the same digest. Everything downstream of it is real: the authorization entry, `__check_auth`,
and the submitted transaction. It opens a wallet, checks the derived address matches the
deployed one, credits it, subscribes, sends, adds a second device, revokes the first, and
confirms the revoked one is refused.

The one thing neither test can cover is the literal secure-element call. For that, open the
site in a browser with Touch ID.

## Notes

- **Relying party.** A passkey is bound to a domain and the wallet stores its hash at
  construction. Wallets created against `localhost` cannot be driven from anywhere else, by
  design. Set `RP_ID` in `site/.env.local` to deploy elsewhere.
- **Activity** is read from token contract events, which the node retains for days but only
  returns by forward scan — see D15 in `DECISIONS.md` before changing it.
- **The pending-authorization map is in memory**, so this runs as one process.
