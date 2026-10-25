# The spike: one UltraHonk proof verified on testnet

Everything else is downstream of this. Do it before writing attribution logic.

**Success = a transaction on testnet whose proof the verifier accepted, plus a measured
number of milliseconds.** Not "a balance went up". Not "it compiled".

---

## Already done

**Testnet is Protocol 29.** This matters: on-chain UltraHonk verification needs the BN254
MSM and Fr host functions from CAP-0080, which landed in Protocol 26. A Protocol-25
network would fail to *link* the verifier, not fail at runtime. We are clear.

**Four funded identities exist** (10,000 test XLM each, via friendbot):

| Identity | Address |
|---|---|
| `ir-issuer` (default) | `GA7NPGYR5C2ZP4XM4RPQXSCWO2XRFAPH3YFJUIJAAMWG3WJO6GUXT4YZ` |
| `ir-introducer` | `GCNFZPZIV2OFKLKM3G7CO7G4X4NXTYCX3ZPLM3C325FE7DDVIHZBXRCR` |
| `ir-investor` | `GCPV3HCDPSVLNAJ6JD4SBWMW6CAS65FLSEQXOC5IQ7WPLS76SZDYMYBC` |
| `ir-auditor` | `GDWFHBUTHVKK4REH4Y5WGW7JKXKSWHZRSV66TXSPINBZUCOIKAMNMFEB` |

```bash
stellar keys ls                       # list
stellar keys address ir-investor      # public key
stellar keys fund ir-investor --network testnet   # top up if you drain one
stellar keys generate <name> --network testnet --fund   # another one
stellar keys rm <name>                # clean up afterwards
```

`ir-issuer` is the default source account, so `--source-account` can be omitted for issuer
operations. The networks (`testnet`, `futurenet`, `mainnet`, `local`) ship preconfigured.

---

## What an UltraHonk proof actually involves

UltraHonk is Noir's standard proving backend (Barretenberg) over the BN254 curve. On-chain
verification runs through a verifier contract built on Nethermind's
[`rs-soroban-ultrahonk`](https://github.com/NethermindEth/rs-soroban-ultrahonk), which calls
`env.crypto().bn254()` for `g1_msm`, Fr arithmetic and `pairing_check`. This is the same
stack OpenZeppelin's Confidential Tokens developer preview runs on.

Two consequences:

1. **Do not write circuits.** OpenZeppelin's v0.8.0 audit covers the confidential token
   contracts *and their circuits*. Writing our own Noir circuit means an unaudited circuit,
   a second toolchain (`nargo` + `bb`), and a day we do not have. We are a consumer of this
   stack, not an author of it — which is also the "Composed" track argument.
2. **The verifier is young and community-maintained.** Fine for a testnet demo with a
   fictional fund. Already disclosed in the README alongside the non-ZK-proof caveat; keep
   it that way.

---

## Spike result — 25 Oct, Path A works

Run in a scratch directory, not in this repo, so an unproven dependency stayed out of the
build. `stellar-confidential-token-sdk@0.1.9` installs clean and **generates real UltraHonk
proofs against OpenZeppelin's shipped circuits.**

| What | Result |
|---|---|
| §5.1 key derivation from a SEP-53 signature | works, deterministic across runs |
| `proveRegister` | **1.2–1.4s**, 14,592-byte proof |
| `proveTransfer` (the fee-claim shape) | **6.5s** |
| Warm-up effect | negligible — second proof ≈ first |

The package ships the compiled circuits (`register`, `transfer`, `withdraw`,
`disclose_sender`, `disclose_recipient`) plus verification keys, and its README claims it
reproduces all 17 of OpenZeppelin's published `SDK.md` fixtures byte-for-byte across 222
tests. It is Apache-2.0, explicitly "testnet only, not audited", and an independent
implementation not affiliated with OpenZeppelin.

**Still open, in priority order:**

1. **On-chain verification has not been done.** We have proofs that the prover produced; we
   have not yet had a deployed verifier accept one. That needs OZ's confidential token
   deployed to testnet. This is the remaining half of the spike.
2. **Local proof verification is unconfirmed** — the `UltraHonkBackend` verify path was
   still running after nine minutes when it was cut short. Building a verification key from
   bytecode is expensive; use the shipped `circuits/vks/` instead of deriving one.
3. **Browser proving will be slower than 6.5s.** Node had threads; a browser needs
   cross-origin isolation for `SharedArrayBuffer`. The dev server now sends
   `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy:
   credentialless` for exactly this. Re-measure in the browser before recording.

**Applied already:** `PROVING_DELAY_MS` in `src/lib/fixtures.ts` is now 6500, so every
screen is built against a realistic wait rather than a guess.

**What 6.5s means for the demo.** Warm-up is negligible, so pre-warming buys nothing — the
cost is the circuit itself. Either the video sits on the progress screen for seven seconds
(the copy there already explains what is happening, which is why it was written that way),
or the fee claim is cut away from. Decide before recording, not during.

**API shapes worth knowing**, since they are not obvious from the README:

```
deriveSk(root, contract, account)  -> { sk, vk, j, addrF, acctF }
deriveKeys(sk, addrF, acctF)       -> { sk, vk, Y, PVK, addrF, acctF }
proveRegister(keys, acctF)         -> { payload, proof }
proveTransfer({ keys, v, r, amount, pvkB, kAudR, kAudS })
                                   -> { payload, proof, recipientView, next, rEScalar }
```

The viewing public key is `PVK`, uppercase. `next` is the new opening — **persist it before
submitting the transaction**, per the SDK's own warning that the opening is the only thing
that can spend a commitment.

---

## Path A — the published client (try this first, timebox it to 45 minutes)

`stellar-confidential-token-sdk@0.1.9` is on npm, Apache-2.0, from the author of the repo
we already flagged. Its own description: *"Conformant TypeScript client for OpenZeppelin
Confidential Tokens on Stellar — key derivation, witness building, **UltraHonk proving**,
local state, selective disclosure."*

That is exactly the layer `src/lib/live.ts` has to be, including the proving.

```bash
npm install stellar-confidential-token-sdk
```

It pins its proving stack: `@aztec/bb.js` 0.87.0, `@noir-lang/noir_js` 1.0.0-beta.9,
`@stellar/stellar-sdk` 16.2.0, plus noble crypto and poseidon2. **Do not "upgrade" those.**
Current npm has bb.js at 5.2.1 and noir_js at 1.0.0-rc.6, and in ZK toolchains a
prover/verifier version mismatch produces proofs that are valid-looking and rejected.
Matched versions are the point of the pin.

Two things to establish in the first ten minutes, because they decide everything after:

- **Does it drive v0.8.0 contracts?** It was published in August and the OZ demo repo is
  known to target the earlier developer preview. If its contract calls do not match
  `stellar-confidential` 0.8.0, Path A is dead — do not try to patch it.
- **How long does one proof take?** Time it the first time it succeeds.

Note it pins `@stellar/stellar-sdk` 16.2.0 while current is 17.3.0. If we also use the
Stellar SDK directly, pin ours to match rather than letting npm resolve two copies.

## Path B — fallback, if Path A does not drive v0.8.0 contracts

Use OpenZeppelin's own deployment examples from `OpenZeppelin/stellar-contracts`: the
verifier registry, auditor registry, allowlist policy, compliant token and factory. Deploy
those to testnet with `stellar contract deploy`, then drive proving from `@aztec/bb.js`
directly using OZ's shipped circuits.

More work, no version-compatibility guesswork. Read `stellar-confidential-token-sdk`'s
source as the reference for key derivation and witness building even if we do not depend on
it — that is the part that is tedious to get right from scratch.

Other working references, freshest first:

- `stellar-experimental/who-ate-gerald` — active October 2026, SDF-adjacent, confidential
  transfers are the core mechanic. Best guess at current API usage.
- `brozorec/stellar-confidential-token-demo` — contracts, SDK and in-browser proving.
  Targets the developer preview, so read the proving path, not the contract calls.
- `berkay1532/confidential-payroll-stellar` — same privacy shape as our fee ledger.

---

## When it works, do these two things immediately

1. **Record the proving time** in `src/lib/fixtures.ts` as `PROVING_DELAY_MS`. The UI is
   already built against a 2,800 ms placeholder, with copy on screen explaining the wait.
   If the real figure is 10+ seconds, that is a demo-video decision (pre-warm the claim, cut
   away, or prove server-side) and the UI dev needs it today, not tomorrow morning.
2. **Write down the contract IDs** — verifier, auditor registry, confidential token — in
   this file. They are needed by `live.ts`, the reset script and the demo seed.

## Abort trigger

No verified proof on testnet by Sunday evening → fall back to a plain token for fee accrual,
keep `IntroducerRailsClient` byte-for-byte identical so the UI never notices, document the
confidential design in the README, and pitch the privacy architecture instead of demoing it.

That decision is cheap *because* the interface is frozen. Do not let it get expensive by
leaving it until 2am.
