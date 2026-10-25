# The spike: one UltraHonk proof verified on testnet

Everything else is downstream of this. Do it before writing attribution logic.

**Success = a transaction on testnet whose proof the verifier accepted, plus a measured
number of milliseconds.** Not "a balance went up". Not "it compiled".

---

## Deployed on testnet — 25 Oct

| What | Contract ID |
|---|---|
| Introducer Rails | `CD55RTP347AHOKTC57QRHNTTXDIST7Q3UITD5VEJXWTWX73DD6Y2TEGH` |
| TUSDC (subscription currency) | `CAU2S7MLSMT3T3OLZLLAEOYXIQ63RIQ3D2CXZGU7BVSABYOBBECCP45I` |
| CSDIF (fund unit) | `CDUDSK7LJATIT4OULSY6PRETCGYY5VIUH35HKDVHNMN3XMRQJAOQWCKO` |

`initialise` and `register_introducer` have both run against it and the introducer reads
back off the chain. 50 bps trail fee, 90-day vesting window, 50,000 minimum.

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

## Spike result, part 2 — OpenZeppelin's suite is deployed; proofs are not yet accepted

**Live on testnet:**

| Contract              | ID                                                         |
|-----------------------|------------------------------------------------------------|
| Confidential verifier | `CCXDZXDL6KHPB2EBTK7COJ2DFLCYOGE3B2IA5K4RCPW7UZ7DIT4EOTUW` |
| Auditor registry      | `CB45BGTIVC256HCUFHY2D42UI3XA2TG2HH3HUTIBZH56SNRWCSEZJWU4` |

All six verification keys are registered on the verifier — `register` (0), `withdraw` (1),
`transfer` (2), `spender_transfer` (3), `set_spender` (4), `clawback` (100) — from
OpenZeppelin's own pinned `circuits/vks/*.vk.bin`. The auditor registry holds the example
Grumpkin generator key under `auditor_id` 0. (That key's secret is literally `1`, so it is
demo-only; a real auditor key comes from the auditor client.)

All five example contracts build: verifier, auditor, allowlist-policy, compliant-token,
factory.

### ✅ CLOSED — the deployed verifier accepted a proof

```
stellar contract invoke --id <verifier> -- verify_proof --circuit_type 0 \
  --proof-file-path proof --public_inputs-file-path public_inputs
→ true
```

On-chain transaction: `b4e99c0c336af63b81b09bc19853d3cb2f1949ad15d9b32b6059594075143442`

**Negative control:** flipping one byte at offset 1000 of the same proof returns `false`.
The verifier is doing real work, not rubber-stamping.

### What it took, and the one thing worth remembering

The SDK's bundled circuits are stale — its verification keys differ from OpenZeppelin
v0.8.0's on every shared circuit (`register`, `transfer`, `withdraw`), so proofs produced
with the SDK's own circuits are rejected.

**But its crypto core is fine.** A §5.1-derived key set from the SDK satisfies
OpenZeppelin's *current* register circuit: `nargo execute` solved the witness first time.
So the working split is:

- **SDK** for key derivation, witness building and local state (the fiddly, spec-bound part)
- **OpenZeppelin's circuits, compiled locally** for the proving itself

Do not use the SDK's bundled `circuits/` directory. `proveTransfer(params, circuit?)` takes
an optional compiled circuit, which is the hook for passing OZ's.

### Toolchain — installed 25 Oct

| Tool | Version | Installed to |
|---|---|---|
| `noirup` | latest | `~/.nargo/bin` (added to `~/.zshrc`) |
| `nargo` | 1.0.0-beta.9 | `~/.nargo/bin` |
| `bbup` | latest | `~/.bb` |
| `bb` | 0.87.0 | `~/.bb` |

Installed from `noirup`'s and `bbup`'s own install scripts, downloaded and read before
running. Both append to shell profiles.

Two version notes that cost time:

- OpenZeppelin's circuits declare `compiler_version = "=1.0.0"`, but **no 1.0.0 release
  exists for aarch64-apple-darwin** — `noirup -v 1.0.0` fails. `1.0.0-beta.9` compiles them
  fine and, critically, reproduces their committed verification keys **byte-for-byte**
  (`./scripts/build_vk_bins.sh` then `git diff` is clean). That check is the one to re-run
  if anything ever stops verifying.
- `bb` 0.87.0 is pinned by OpenZeppelin *and* by the SDK, so the proving stack is agreed.

### Reproducing a proof

```bash
cd packages/confidential/circuits
nargo compile
nargo execute --package circuit_register register_witness   # needs Prover.toml
bb prove -s ultra_honk --oracle_hash keccak \
   -b target/circuit_register.json -w target/register_witness.gz -o <out>
```

`--oracle_hash keccak` is **required** (bb defaults to poseidon2; the on-chain verifier uses
Keccak for the Fiat-Shamir transcript). Do **not** pass `--zk` — the verifier implements only
the non-zk flavour, which is the caveat the README already discloses.

### A demo-relevant timing surprise

Native `bb prove` for `register` took **0.11s**. The same circuit through `bb.js` (WASM) in
Node took **1.2-1.4s**, and a transfer took 6.5s. Native proving is roughly an order of
magnitude faster.

That reopens a demo decision: if the fee claim proves **server-side with native bb** rather
than in the browser, it could be sub-second instead of seven. `PROVING_DELAY_MS` stays at
6500 for the in-browser path, but a server-side prover is now a credible way to make the
claim feel instant on camera.

## Spike result, part 1 — 25 Oct, Path A proves

Run in a scratch directory, not in this repo, so an unproven dependency stayed out of the
build. `stellar-confidential-token-sdk@0.1.9` installs clean and **generates real UltraHonk
proofs against OpenZeppelin's shipped circuits.**

| What                                        | Result                            |
|---------------------------------------------|-----------------------------------|
| §5.1 key derivation from a SEP-53 signature | works, deterministic across runs  |
| `proveRegister`                             | **1.2–1.4s**, 14,592-byte proof   |
| `proveTransfer` (the fee-claim shape)       | **6.5s**                          |
| Warm-up effect                              | negligible — second proof ≈ first |

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

---

## Moving fee balances into the confidential token — UNBLOCKED (see resolution below)

Attempted. **Do not do this yet**, and the reason is specific rather than vague.

### What works

| Operation | Proof needed | Status |
|---|---|---|
| `register` | register circuit | ✅ works — proof accepted on-chain |
| `deposit(from, to, amount)` | **none** — `from.require_auth()` only | ✅ available |
| `confidential_transfer` | transfer circuit | ❌ blocked |
| `withdraw` | withdraw circuit | ❌ blocked |

Deposit needs no proof because the amount going *in* is public anyway; it is the balance at
rest and the transfers that are encrypted.

### The blocker: one witness field

The SDK's witness builders are **one parameter short** of OpenZeppelin v0.8.0 on both
circuits that would move a fee out:

```
transfer:  SDK 29 params, OZ 30  — missing r_tilde_aud_s
withdraw:  SDK 19 params, OZ 20  — missing r_tilde_aud_s
```

Same field both times. It is the sender-auditor escrow of the new spendable blinding (T_a9
in the circuit docs), enforced by `assert(r_new + m_s[2] == r_tilde_aud_s)`. `register` has
no auditor component, which is exactly why that circuit worked.

It cannot be guessed: `m_s[2]` is a per-proof sigma-protocol nonce generated inside the
SDK's prover and not exposed. Closing the gap means patching
`buildTransferWitness` / `buildWithdrawWitness` to emit the sum — tractable, bounded, and
genuinely cryptographic work. A wrong value does not fail loudly; it produces a proof the
verifier rejects, or worse an unsound one.

### Why moving the balances anyway would make the demo worse

Deposit alone would give fee balances that are **encrypted at rest but cannot be claimed**.
The never-cut demo beat is the *claim*. Trading a working public claim for an encrypted
balance nobody can withdraw loses the demo and gains a property no one watching can see.

So the order is: close the witness gap first, then move the balances. If the gap does not
close, the honest fallback already stands — public fee amounts, a real proof gate on the
claim (which works today against the live verifier), and the privacy architecture pitched
rather than demoed.


---

## ✅ The witness gap is closed — all three circuits verify on-chain

| Circuit | `nargo execute` | Deployed verifier |
|---|---|---|
| `register` (0) | solved | **true** |
| `withdraw` (1) | solved | **true** |
| `transfer` (2) | solved | **true** |

It was one deterministic field, not a nonce. The circuit docs give it outright:

```
T_a9:  r_tilde_aud_s = r_new + m_s[2]
m_s    = sponge_squeeze_3(AUDITOR_SENDER, ecdh(r_e, k_aud_s), sigma)
r_new  = derive_spend_r(vk, sigma)
```

v0.8.0 widened the sender-auditor mask from two lanes to three, adding an escrow slot for
the new spendable blinding. The SDK only ships `spongeSqueeze2`. OpenZeppelin's own lib says
`sponge_squeeze_3(..)[0..2] == sponge_squeeze_2(..)` by construction — one rate-3 absorb
block, same permutation, the two functions differ only in how much state they expose. So the
SDK's existing auditor values were never wrong; lane 2 was simply not being read.

Rebuilding the permutation with `@zkpassport/poseidon2` (the SDK's own dependency) recovers
it. **No SDK internals were patched** and no nonce was invented — every input is derived from
values the SDK already exposes.

### How it is kept honest

`src/lib/confidential.ts` recomputes lanes 0 and 1 and compares them to the SDK's
`spongeSqueeze2`. A mismatch throws rather than emitting a witness. That matters more than
usual here: a wrong mask does not fail loudly, it produces a proof the verifier rejects — or,
worse, one that is unsound. Three independent checks had to pass before the value was used:

1. our lanes 0,1 == `spongeSqueeze2`
2. `v_transfer + m_s[0] == v_tilde_aud_s`  (T_a7, proves `s_a_s` and `sigma` are right)
3. `v_new + m_s[1] == b_tilde_aud_s`  (T_a8)

Then `nargo execute` solving the circuit, and finally the deployed verifier returning `true`.

`register` needed none of this — it has no auditor channel, which is exactly why it worked
first time.

### What this unblocks

Confidential transfer and withdraw are now both available, so fee balances **can** move into
the confidential token with a working claim path out. That is the remaining integration:
deploy the token, register accounts, deposit, and switch `claim_circuit` from `Register` to
`Transfer`.

Delete `src/lib/confidential.ts` when the SDK ships a build against v0.8.0 circuits.


---

## ✅ Fee balances are in the confidential token

The amount is an elliptic-curve commitment on-chain, not a number.

| Contract | ID |
|---|---|
| Confidential token | `CDHJYRAMWXJXNSSA36YIZFSMPWRBDN2KLLEY5KWLOS2P2JXKXIDSN3YX` |
| Allowlist policy | `CAX3QU5ZIJG4KZSDJRRXGJDX2252DVMJ27673XYTNTTO334XJYP25ONS` |
| Verifier | `CCXDZXDL6KHPB2EBTK7COJ2DFLCYOGE3B2IA5K4RCPW7UZ7DIT4EOTUW` |
| Auditor registry | `CB45BGTIVC256HCUFHY2D42UI3XA2TG2HH3HUTIBZH56SNRWCSEZJWU4` |

Wrapping TUSDC, `sac_passthrough: true`, policy enforced, with `freezer`, `config_manager`
and `clawback` roles granted.

### What ran on testnet

1. **allowlist** — introducer listed (`allowed → true`)
2. **register** — real proof, `Event: Register`
3. **deposit** — 1,250 TUSDC, the exact trail fee on a 250,000 subscription, `Event: Deposit`
4. **merge** — `Event: Merge`, receiving folded into spendable

Custody is real: the token contract holds `12500000000` stroops of TUSDC.

The balance afterwards:

```
spendable_commitment  13bf8cc0f3254b57bc65dbaa8a3887d8be2fac8a512a7fb1…   (64-byte point)
receiving_commitment  identity (zero)
```

**That is the demo beat.** The fee is a curve point. Only the introducer, the issuer and the
auditor can read what it is worth.

### Two traps, both already paid for

**`proveRegister` uses the SDK's bundled circuit, which is the stale preview one.** It
produces a proof the token rejects with `InvalidProof` (3506). Build the witness with
`buildRegisterWitness`, then prove against OpenZeppelin's compiled circuit with nargo + bb.
The same applies to every circuit: use the SDK for witnesses, never for proving.

**`encodeRegisterData` already returns `scvBytes(xdr)`.** Calling `.toXDR()` on the result
double-wraps it and the contract fails with `InvalidData` (3507). Use `.bytes()`.

The two errors are easy to confuse and they mean different things: 3507 is the envelope not
decoding, 3506 is the envelope decoding fine and the proof being wrong.

### What is left

`claim_fee` still moves a public `i128`. The confidential path it should call is
`confidential_transfer`, whose proof now works. Switch `claim_circuit` from `Register` to
`Transfer` and have the contract call the token rather than the SAC.
