#!/usr/bin/env bash
#
# Confidential-token operations that need a proof against OpenZeppelin's
# CURRENT circuits. The SDK ships the stale developer-preview ones, so every
# proof here is built in three steps: the SDK writes the witness, nargo+bb
# prove it against OZ's circuit, and the SDK encodes the payload.
#
#   ./scripts/confidential.sh register <identity>
#
# Needs nargo and bb (see contracts/SPIKE.md) and OZ's compiled circuits.
# Point CIRCUITS at a checkout of OpenZeppelin/stellar-contracts if the default
# is gone: packages/confidential/circuits, after `nargo compile`.

set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.nargo/bin:$HOME/.bb:$HOME/.cargo/bin:$PATH"

CIRCUITS=${CIRCUITS:-}
[ -d "${CIRCUITS:-}" ] || { echo "Set CIRCUITS to OpenZeppelin's packages/confidential/circuits"; exit 1; }
WORK=$(mktemp -d)

# Everything that carries a witness value. Prover.toml and the solved .gz both
# contain `sk` — the confidential SPENDING KEY — and v_transfer, the commission
# in the clear. nargo insists on reading Prover.toml from the package dir, so
# these land outside $WORK and outside the repo, where git will never catch
# them. Scrubbed immediately after proving AND again on exit.
# Named circuits are not enough: a withdraw/Prover.toml with `sk` in it
# survived from unrelated witness work and neither of us had noticed. Sweep
# every package instead, so a circuit nobody has written yet is covered too.
scrub() {
  find "$CIRCUITS" -name 'Prover.toml' -delete 2>/dev/null || true
  find "$CIRCUITS/target" -name '*witness*.gz' -delete 2>/dev/null || true
}
trap 'scrub; rm -rf "$WORK"' EXIT

TOKEN=$(grep '^OZ_TOKEN=' .contract-id | cut -d= -f2)

case "${1:-}" in
register)
  ID=$2
  ADDR=$(stellar keys address "$ID")
  echo "Registering $ID ($ADDR) confidentially"

  IR_SECRET=$(stellar keys secret "$ID") \
    node scripts/conf-register.mjs "$TOKEN" toml "$CIRCUITS/register/Prover.toml"

  ( cd "$CIRCUITS" && nargo execute --package circuit_register reg_witness >/dev/null )
  bb prove -s ultra_honk --oracle_hash keccak \
    -b "$CIRCUITS/target/circuit_register.json" \
    -w "$CIRCUITS/target/reg_witness.gz" -o "$WORK" >/dev/null
  scrub
  echo "  proved against OZ's register circuit (witness scrubbed)"

  IR_SECRET=$(stellar keys secret "$ID") \
    node scripts/conf-register.mjs "$TOKEN" data "$WORK/data.bin" "$WORK/proof"

  stellar contract invoke --id "$TOKEN" --source "$ID" --network testnet --send=yes \
    -- register --account "$ADDR" --auditor_id 0 --data-file-path "$WORK/data.bin" \
    2>&1 | grep -oE "Event: [A-Za-z]+|Error\(Contract, #[0-9]+\)" | head -2
  ;;
settle)
  # ./scripts/confidential.sh settle <code> <basis-in-stroops>
  CODE=$2; BASIS=$3
  CONTRACT=$(grep '^E2E_CONTRACT=' contracts/.e2e-state | cut -d= -f2)
  ISSUER=$(stellar keys address ir-issuer)
  AUDITOR=083e7911d835097629f0067531fc15cafd79a89beecb39903f69572c636f4a5a1a7f5efaad7f315c25a918f30cc8d7333fccab7ad7c90f14de81bcc528f9935d

  # The rate is read from a gitignored file. This is the number the design
  # exists to protect — it never reaches the chain in any form.
  BPS=$(python3 -c "import json;print(json.load(open('contracts/rates.json'))['$CODE'])")
  AMOUNT=$(python3 -c "print($BASIS * $BPS // 10000)")
  echo "Settling $CODE off-chain at a privately held rate"
  # The basis is already public on chain via claimable_basis. The amount is
  # NOT printed: amount / basis is the rate, so showing it here would put the
  # number this design protects into the terminal — and into the demo video,
  # since e2e-testnet.sh pipes this output into its log.
  echo "  basis  $(python3 -c "print(f'{$BASIS/10**7:,.2f}')")  (public on chain)"
  echo "  amount withheld — printing it alongside the basis reveals the rate"

  TO=$(stellar contract invoke --id "$CONTRACT" --source ir-issuer --network testnet \
    -- get_introducer --code "$CODE" 2>/dev/null | tail -1 \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['owner'])")
  PVKB=$(stellar contract invoke --id "$TOKEN" --source ir-issuer --network testnet \
    -- confidential_balance --account "$TO" 2>/dev/null | tail -1 \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['viewing_public_key'])")

  # Openings are the asset: the sender's (v, r) is the only thing that can
  # spend their commitment, so it is tracked here and rolled forward.
  . contracts/.conf-state
  # Never print the opening. (v, r) is what spends the pool, and successive
  # v values differ by exactly the commission, which hands over the rate too.
  echo "  spending from the issuer's confidential pool"

  IR_SECRET=$(stellar keys secret ir-issuer) node scripts/conf-settle.mjs "$TOKEN" witness \
    "$CONF_V" "$CONF_R" "$AMOUNT" "$PVKB" "$AUDITOR" "$WORK"
  cp "$WORK/Prover.toml" "$CIRCUITS/transfer/Prover.toml"
  ( cd "$CIRCUITS" && nargo execute --package circuit_transfer tx_witness >/dev/null )
  bb prove -s ultra_honk --oracle_hash keccak \
    -b "$CIRCUITS/target/circuit_transfer.json" \
    -w "$CIRCUITS/target/tx_witness.gz" -o "$WORK" >/dev/null
  scrub
  echo "  proved against OZ's transfer circuit (witness scrubbed)"

  IR_SECRET=$(stellar keys secret ir-issuer) node scripts/conf-settle.mjs "$TOKEN" data "$WORK"

  NV=$(python3 -c "import json;d=json.load(open('$WORK/witness.json'));print(d['next']['v'])")
  NR=$(python3 -c "import json;d=json.load(open('$WORK/witness.json'));print(d['next']['r'])")

  # Persist the NEW opening BEFORE submitting. The asymmetry matters: if the
  # transfer lands and we never recorded `next`, the pool is unspendable
  # forever — the opening is the only thing that can spend a commitment, and
  # $WORK is a mktemp that this script deletes on exit. If instead the
  # transfer fails, nothing is lost: .conf-state.prev rolls it back.
  cp contracts/.conf-state contracts/.conf-state.prev
  printf 'CONF_V=%s\nCONF_R=%s\n' "$NV" "$NR" > contracts/.conf-state

  # Keep the error: a bare "rejected" with no reason is useless at 3am.
  stellar contract invoke --id "$TOKEN" --source ir-issuer --network testnet --send=yes \
    -- confidential_transfer --from "$ISSUER" --to "$TO" --data-file-path "$WORK/data.bin" \
    >"$WORK/invoke.out" 2>&1 || true

  # Ask the CHAIN whether it landed, rather than parsing the CLI's output.
  # A successful transfer was once read as a rejection, and the rollback that
  # followed left .conf-state pointing at a commitment that no longer existed.
  SPENDABLE=$(stellar contract invoke --id "$TOKEN" --source ir-issuer --network testnet \
    -- confidential_balance --account "$ISSUER" 2>/dev/null | tail -1 \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['spendable_commitment'])")
  . contracts/.conf-state.prev

  if node scripts/conf-check.mjs "$NV" "$NR" "$SPENDABLE"; then
    echo "  Event: Transfer  (confirmed against the chain commitment)"
    rm -f contracts/.conf-state.prev
  elif node scripts/conf-check.mjs "$CONF_V" "$CONF_R" "$SPENDABLE"; then
    mv contracts/.conf-state.prev contracts/.conf-state
    echo "  transfer rejected — opening rolled back, pool still spendable"
    grep -oE "Error\([A-Za-z]+, #?[0-9]+\)" "$WORK/invoke.out" | head -1 | sed 's/^/    reason: /'
    grep -oE "fn_return, [a-z_]+\], data:(true|false)" "$WORK/invoke.out" | head -2 | sed 's/^/    /'
    exit 1
  else
    echo "  WARNING: chain matches NEITHER opening. Someone else spent from this"
    echo "  account, or state moved underneath us. Recover with scripts/conf-check.mjs"
    echo "  before settling again. Keeping the post-transfer opening."
    exit 1
  fi
  ;;
*)
  echo "usage: $0 register <identity> | settle <code> <basis>"; exit 1;;
esac
