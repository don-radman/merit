# `src/lib` — the seam

Everything the UI is allowed to know about the chain is in this folder.

| File | Owner | What it is |
|---|---|---|
| `types.ts` | both — **frozen** | The interface. Changing a signature here is a conversation, not a commit. |
| `fixtures.ts` | UI dev | Hand-designed demo data. The figures are chosen to be legible on screen. |
| `stub.ts` | UI dev | Fake implementation. Build screens against this from hour 2. |
| `live.ts` | contracts dev | Real implementation. Reads are live; writes still delegate to the stub. |
| `index.ts` | both | The swap point. One constant decides stub or live. |

## Why it is shaped like this

The UI never imports the Stellar SDK, never builds a transaction, never holds a keypair
and never sees a ciphertext. Passkey signing, view-key decryption, transaction assembly
and confirmation-waiting all live behind this interface, because those are the four places
where code that looks correct fails quietly.

That boundary is also what lets both people work at once. The signatures were frozen
before either implementation existed.

## Going live, one method at a time

1. Create `live.ts` exporting `createLiveClient(config): IntroducerRailsClient`.
2. Implement the method that just landed. Delegate everything else to the stub:

   ```ts
   const stub = createStubClient(config);
   return { ...stub, subscribe: realSubscribe };
   ```

3. Flip `MODE` in `index.ts` (or set `VITE_CLIENT_MODE=live`).
4. Walk all three screens. Including the failure paths.

Partial live mode is the point — the investor screen can be real while the issuer ledger
is still fixtures.

### Where that has got to

`liveMethods` is the honest list, exported so a screen can ask rather than guess:
`resolveCode`, `getBook`, `getLedger` and `getAuditorAttestation` read the deployed contract
through read-only simulations. Everything that writes — `subscribe`, `claim`, anything
touching a passkey — still delegates to the stub, so `mode` reports `'live'` while a good
deal behind it is not. Check `liveMethods` before claiming a screen is real.

| Variable | Default | What it does |
|---|---|---|
| `VITE_CLIENT_MODE` | `stub` | `live` swaps the reads onto the chain. |
| `VITE_CONTRACT_ID` | the seeded instance | Which deployment to read. |
| `VITE_TRAIL_FEE_BPS` | `50` | **This** introducer's own rate. Applied locally; never on chain. |
| `VITE_VESTING_WINDOW_SECS` | `300` | Must match the deployment — `initialise` fixes it and there is no getter, so a wrong value puts a wrong window on screen. |
| `VITE_READ_SOURCE` | a funded testnet account | Simulation source only. Never signs. |

Write `import.meta.env.VITE_X` exactly, with no cast and no optional chaining. Vite replaces
that literal expression at build time; wrap it and the substitution silently stops happening
and the value reads `undefined`. That cost a restart's worth of confusion once already.

## Promises resolve on confirmation, not on submission

Every method that writes to the chain resolves only once the transaction is confirmed, so
the UI can be naive about it. `subscribe()` reports progress through `onStage` instead.

## Two things the stub does on purpose

**It is slow where the real thing is slow.** `generating-proof` waits
`PROVING_DELAY_MS`. Proof generation is a real, visible wait and the UI needs a spinner
with copy. Replace the constant with the measured figure once the spike lands.

**It can be made to fail.** `setStubFailure('passkey-declined')` arms the next call to
reject. Every `ClientErrorCode` in `types.ts` needs a UI state — run through them before
calling a screen done:

```ts
import { setStubFailure } from '../lib';
setStubFailure('insufficient-usdc');  // next call rejects
setStubFailure(null);                 // disarm
```

## Resetting between takes

`client.resetDemo()` returns everything to seeded fixture state. Bind it to a key. You
will use it more than anything else in here while recording.
