# Test data

`register.proof` / `register.public_inputs` — a real UltraHonk proof for OpenZeppelin's
`register` circuit, generated with nargo 1.0.0-beta.9 and bb 0.87.0 against the v0.8.0
circuits (`bb prove -s ultra_honk --oracle_hash keccak`, no `--zk`).

The deployed verifier accepts it; flipping one byte makes it reject. Committed so
`scripts/e2e-testnet.sh` is self-contained and does not need the Noir toolchain installed.

It is a *register* proof, not a claim proof — `claim_circuit` is set to `Register` because
that is the circuit we have a working witness for. See contracts/SPIKE.md for why the
transfer witness is still blocked.
