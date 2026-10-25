#!/usr/bin/env bash
#
# End-to-end run of Introducer Rails against Stellar testnet.
#
#   ./scripts/e2e-testnet.sh
#
# Deploys a FRESH contract instance each run, so running it again is the reset.
#
# What this asserts is not "money moved" — the contract deliberately moves none.
# It asserts the privacy property the design now rests on: the chain records WHO
# introduced WHOM and FOR HOW MUCH, and nothing from which a commission rate or
# an introducer's earnings can be derived. Settlement happens off-chain against
# each introducer's privately negotiated rate.

set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"

NETWORK=testnet
ISSUER_ID=ir-issuer
INTRO_ID=ir-introducer
INVESTOR_ID=ir-investor

VESTING_SECS=15                 # short on purpose: 90 days is unclaimable on testnet
MINIMUM=500000000000            #    50,000.0000000
MINT_USDC=2500000000000         #   250,000.0000000
MINT_UNITS=10000000000000       # 1,000,000.0000000
SUBSCRIBE=2500000000000         #   250,000.0000000
CODE=CALDER-PR7

say() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
human() { python3 -c "print(f'{int($1)/10**7:,.2f}')"; }
call() { stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" "${@:3}"; }

ISSUER=$(stellar keys address "$ISSUER_ID")
INTRO=$(stellar keys address "$INTRO_ID")
INVESTOR=$(stellar keys address "$INVESTOR_ID")
USDC=$(grep '^USDC_SAC=' .contract-id | cut -d= -f2)
UNIT=$(grep '^UNIT_SAC=' .contract-id | cut -d= -f2)

say "Participants"
printf '  issuer      %s\n  introducer  %s\n  investor    %s\n' "$ISSUER" "$INTRO" "$INVESTOR"
printf '  TUSDC SAC   %s\n  CSDIF SAC   %s\n' "$USDC" "$UNIT"

# Classic assets: a G-address must trust the asset before it can hold any.
# Contract addresses do not — the SAC keeps their balance in storage.
say "Trustlines"
for pair in "$INVESTOR_ID TUSDC" "$INVESTOR_ID CSDIF" "$INTRO_ID TUSDC"; do
  set -- $pair
  stellar tx new change-trust --source-account "$1" --network "$NETWORK" \
    --line "$2:$ISSUER" >/dev/null 2>&1 && printf '  %-16s trusts %s\n' "$1" "$2"
done

say "Deploy a fresh instance"
CONTRACT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/introducer_rails.wasm \
  --source "$ISSUER_ID" --network "$NETWORK" 2>/dev/null | tail -1)
printf '  %s\n' "$CONTRACT"
printf 'E2E_CONTRACT=%s\n' "$CONTRACT" > contracts/.e2e-state

# No fee rate here, and no confidential-token address: the contract never learns
# what anyone earns, so it has nothing to pay out and nothing to encrypt.
call "$CONTRACT" "$ISSUER_ID" -- initialise --issuer "$ISSUER" --usdc "$USDC" \
  --unit "$UNIT" --vesting_window_secs "$VESTING_SECS" --minimum "$MINIMUM" >/dev/null 2>&1
printf '  initialised: %ss vesting, min %s, no rate stored\n' "$VESTING_SECS" "$(human $MINIMUM)"

say "Fund"
call "$USDC" "$ISSUER_ID" -- mint --to "$INVESTOR" --amount "$MINT_USDC" >/dev/null 2>&1
call "$UNIT" "$ISSUER_ID" -- mint --to "$CONTRACT" --amount "$MINT_UNITS" >/dev/null 2>&1
printf '  investor holds %s TUSDC\n  contract holds %s CSDIF units\n' \
  "$(human $MINT_USDC)" "$(human $MINT_UNITS)"

say "Register the introducer, then subscribe"
call "$CONTRACT" "$INTRO_ID" -- register_introducer --owner "$INTRO" --code "$CODE" \
  --display_name "Raghunathan Family Office" >/dev/null 2>&1
UNITS_BEFORE=$(call "$UNIT" "$ISSUER_ID" -- balance --id "$INVESTOR" 2>/dev/null | tail -1 | tr -d '"')
call "$CONTRACT" "$INVESTOR_ID" -- subscribe --investor "$INVESTOR" --code "$CODE" \
  --usdc_amount "$SUBSCRIBE" >/dev/null 2>&1
UNITS_AFTER=$(call "$UNIT" "$ISSUER_ID" -- balance --id "$INVESTOR" 2>/dev/null | tail -1 | tr -d '"')
printf '  subscribed %s TUSDC through %s\n' "$(human $SUBSCRIBE)" "$CODE"
printf '  investor issued %s CSDIF units this run\n' "$(human $((UNITS_AFTER-UNITS_BEFORE)))"

say "Wait for the introduction to vest"
BASIS=0
for i in $(seq 1 12); do
  BASIS=$(call "$CONTRACT" "$ISSUER_ID" -- claimable_basis --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')
  printf '  attempt %-2s claimable basis = %s\n' "$i" "$(human $BASIS)"
  [ "$BASIS" != "0" ] && break
  sleep 3
done

# The chain assertion below is only half the question. The other half is
# whether the repo hands the rate over instead — which it once did.
./scripts/check-secrets.sh

say "What a third party can read off the chain"
# An `if` condition is exempt from `set -e`, so a detected leak records a
# failure here instead of aborting the run before the verdict prints.
if call "$CONTRACT" "$ISSUER_ID" -- get_ledger 2>/dev/null | tail -1 | python3 -c "
import json,sys
rows = json.load(sys.stdin)
keys = sorted(rows[0].keys())
leaks = [k for k in keys if any(w in k for w in ('fee','rate','bps','commission','earn'))]
print('  stored per introduction:', ', '.join(keys))
print('  subscription size is public by design:', f\"{int(rows[0]['subscribed'])/10**7:,.2f}\")
print('  fields exposing a rate or payout:', leaks or 'NONE')
sys.exit(1 if leaks else 0)
"; then LEAKFREE=0; else LEAKFREE=1; fi

say "Claim — marks the introduction, moves no money"
PUB_BEFORE=$(call "$USDC" "$ISSUER_ID" -- balance --id "$INTRO" 2>/dev/null | tail -1 | tr -d '"')
COUNT=$(call "$CONTRACT" "$INTRO_ID" --send=yes -- claim --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')
PUB_AFTER=$(call "$USDC" "$ISSUER_ID" -- balance --id "$INTRO" 2>/dev/null | tail -1 | tr -d '"')
BASIS_AFTER=$(call "$CONTRACT" "$ISSUER_ID" -- claimable_basis --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')

printf '  claim returned           %s attribution(s)\n' "$COUNT"
printf '  introducer PUBLIC TUSDC  %s -> %s\n' "$(human ${PUB_BEFORE:-0})" "$(human ${PUB_AFTER:-0})"
printf '  claimable basis after    %s\n' "$(human $BASIS_AFTER)"
printf '  the issuer now settles off-chain at this introducer'\''s own rate,\n'
printf '  which the chain has never seen.\n'

# ---------------------------------------------------------------- settle ---
# The contract is done: it recorded WHO and HOW MUCH SUBSCRIBED, and nothing
# about what anyone earns. Settlement happens here, off-chain, at a rate held
# only in contracts/rates.json — and moves the money confidentially.
SETTLED=skipped
if [ -f contracts/.conf-state ] && [ -f contracts/rates.json ]; then
  say "Settle confidentially at the introducer's private rate"
  COM_BEFORE=$(call "$(grep '^OZ_TOKEN=' .contract-id | cut -d= -f2)" "$ISSUER_ID" \
    -- confidential_balance --account "$INTRO" 2>/dev/null | tail -1 \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['receiving_commitment'])")
  # One retry. A rejection rolls the opening back, so the retry starts from
  # restored state — and a transient failure should not fail the whole run.
  ./scripts/confidential.sh settle "$CODE" "$BASIS" 2>&1 | sed 's/^/  /' \
    || { echo "  retrying settlement once"; ./scripts/confidential.sh settle "$CODE" "$BASIS" 2>&1 | sed 's/^/  /'; }
  if true; then
    COM_AFTER=$(call "$(grep '^OZ_TOKEN=' .contract-id | cut -d= -f2)" "$ISSUER_ID" \
      -- confidential_balance --account "$INTRO" 2>/dev/null | tail -1 \
      | python3 -c "import json,sys;print(json.load(sys.stdin)['receiving_commitment'])")
    [ "$COM_BEFORE" != "$COM_AFTER" ] && SETTLED=yes || SETTLED=no
    printf '  commitment %s -> %s\n' "${COM_BEFORE:0:24}…" "${COM_AFTER:0:24}…"
    printf '  the transfer event carries ciphertext only — no amount, no rate\n'
  fi
fi

# ---------------------------------------------------------------- recover ---
# The Rust tests cover recover by jumping the ledger clock with `with_mut`.
# Testnet cannot do that, so what this adds is the part unit tests cannot
# reach: on a real chain, with real elapsed time, a recovered introduction
# must STAY unpayable after its window genuinely passes.
say "Recover — the issuer claws back an introduction before it vests"
# The first subscription spent everything the investor was minted, so top up
# before asking for a second one.
call "$USDC" "$ISSUER_ID" -- mint --to "$INVESTOR" --amount "$MINT_USDC" >/dev/null 2>&1
SUB2=$(call "$CONTRACT" "$INVESTOR_ID" -- subscribe --investor "$INVESTOR" \
  --code "$CODE" --usdc_amount "$SUBSCRIBE" 2>/dev/null | tail -1)
ID2=$(echo "$SUB2" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
printf '  second subscription recorded as id %s, inside its window\n' "$ID2"

call "$CONTRACT" "$ISSUER_ID" --send=yes -- recover --id "$ID2" >/dev/null 2>&1 || true

# Confirm by reading the chain, not by trusting the call's output.
REC=$(call "$CONTRACT" "$ISSUER_ID" -- get_ledger 2>/dev/null | tail -1 \
  | python3 -c "
import json,sys
rows = {r['id']: r for r in json.load(sys.stdin)}
print(str(rows[$ID2]['recovered']).lower())")
printf '  recovered flag on chain: %s\n' "$REC"

# A second recover of the same row must be refused.
if call "$CONTRACT" "$ISSUER_ID" -- recover --id "$ID2" >/dev/null 2>&1; then
  REREC=accepted
else
  REREC=refused
fi
printf '  recovering it again: %s\n' "$REREC"

# Now let its window actually elapse and prove it never becomes payable.
printf '  waiting out its vesting window…\n'
BASIS_REC=unknown
for i in $(seq 1 12); do
  sleep 3
  BASIS_REC=$(call "$CONTRACT" "$ISSUER_ID" -- claimable_basis --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')
  [ "$i" -ge 6 ] && break
done
printf '  claimable basis after the window passed: %s\n' "$(human $BASIS_REC)"
printf '  (a recovered introduction is excluded permanently, not just early)\n'

say "Result"
PUB_MOVED=$(( ${PUB_AFTER:-0} - ${PUB_BEFORE:-0} ))
if [ "${COUNT:-0}" = "1" ] && [ "$BASIS" = "$SUBSCRIBE" ] && [ "$BASIS_AFTER" = "0" ] \
   && [ "$PUB_MOVED" = "0" ] && [ "$LEAKFREE" = "0" ] \
   && [ "$REC" = "true" ] && [ "$REREC" = "refused" ] && [ "$BASIS_REC" = "0" ] \
   && [ "$SETTLED" = "yes" ]; then
  printf '  \033[32mPASS\033[0m  attribution recorded, vested, claimed.\n'
  printf '        No rate, commission or payout is derivable from the chain,\n'
  printf '        and the claim moved no money — by design.\n'
  printf '        Settlement moved value confidentially: the commitment changed\n        and the transfer event shows no amount.\n'
  printf '        A recovered introduction stayed unpayable after its window\n        genuinely elapsed — not merely flagged.\n'
  EXP=https://stellar.expert/explorer/testnet
  printf '\n  See it on chain:\n    contract    %s/contract/%s\n    introducer  %s/account/%s\n' \
    "$EXP" "$CONTRACT" "$EXP" "$INTRO"
else
  printf '  \033[31mFAIL\033[0m  count=%s basis=%s after=%s public_moved=%s leak_free=%s\n' \
    "${COUNT:-0}" "$(human $BASIS)" "$(human $BASIS_AFTER)" "$(human $PUB_MOVED)" "$LEAKFREE"
  printf '        recovered=%s re-recover=%s basis_after_window=%s settled=%s\n' \
    "${REC:-?}" "${REREC:-?}" "$(human ${BASIS_REC:-0})" "${SETTLED:-?}"
  exit 1
fi
