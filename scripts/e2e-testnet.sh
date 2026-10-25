#!/usr/bin/env bash
#
# End-to-end run of Introducer Rails against Stellar testnet.
#
#   ./scripts/e2e-testnet.sh
#
# Deploys a FRESH contract instance each run, so running it again is the reset.
# Nothing here needs the Noir toolchain: the claim proof is a committed fixture
# (contracts/testdata/), already verified by the deployed OpenZeppelin verifier.
#
# Amounts are in stroops (7 decimals), which is what the SACs use. The human
# figures are the ones from the demo fixtures: 250,000 subscribed, 50 bps, so a
# 1,250 fee.

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
EXPECT_FEE=12500000000          #     1,250.0000000  (50 bps)
CODE=CALDER-PR7

say() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
human() { python3 -c "print(f'{int($1)/10**7:,.2f}')"; }

# ---------------------------------------------------------------- addresses --
ISSUER=$(stellar keys address "$ISSUER_ID")
INTRO=$(stellar keys address "$INTRO_ID")
INVESTOR=$(stellar keys address "$INVESTOR_ID")
USDC=$(grep '^USDC_SAC=' .contract-id | cut -d= -f2)
UNIT=$(grep '^UNIT_SAC=' .contract-id | cut -d= -f2)
VERIFIER=$(grep '^OZ_VERIFIER=' .contract-id | cut -d= -f2)
CTOKEN=$(grep '^OZ_TOKEN=' .contract-id | cut -d= -f2)
ALLOWLIST=$(grep '^OZ_ALLOWLIST=' .contract-id | cut -d= -f2)

say "Participants"
printf '  issuer      %s\n  introducer  %s\n  investor    %s\n' "$ISSUER" "$INTRO" "$INVESTOR"
printf '  TUSDC SAC   %s\n  CSDIF SAC   %s\n' "$USDC" "$UNIT"
printf '  verifier    %s\n  conf token  %s\n' "$VERIFIER" "$CTOKEN"

# The confidential token credits only registered accounts — "the depositor does
# not need a registered confidential account; only `to` does."
say "Preflight: is the introducer registered confidentially?"
if stellar contract invoke --id "$CTOKEN" --source "$ISSUER_ID" --network "$NETWORK" \
     -- confidential_balance --account "$INTRO" >/dev/null 2>&1; then
  printf '  yes — claim_fee can deposit to them\n'
else
  printf '  NO. Register them first; claim_fee will fail.\n'; exit 1
fi

# -------------------------------------------------------------- trustlines ---
# Classic assets: a G-address must trust the asset before it can hold any.
# Contract addresses do not need this — the SAC keeps their balance in storage.
say "Trustlines"
for pair in "$INVESTOR_ID TUSDC" "$INVESTOR_ID CSDIF" "$INTRO_ID TUSDC"; do
  set -- $pair
  stellar tx new change-trust --source-account "$1" --network "$NETWORK" \
    --line "$2:$ISSUER" >/dev/null 2>&1 && printf '  %-16s trusts %s\n' "$1" "$2"
done

# ------------------------------------------------------------------ deploy ---
say "Deploy a fresh instance"
CONTRACT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/introducer_rails.wasm \
  --source "$ISSUER_ID" --network "$NETWORK" 2>/dev/null | tail -1)
printf '  %s\n' "$CONTRACT"
printf 'E2E_CONTRACT=%s\n' "$CONTRACT" > contracts/.e2e-state

stellar contract invoke --id "$CONTRACT" --source "$ISSUER_ID" --network "$NETWORK" \
  -- initialise --issuer "$ISSUER" --usdc "$USDC" --unit "$UNIT" \
  --trail_fee_bps 50 --vesting_window_secs "$VESTING_SECS" --minimum "$MINIMUM" \
  --confidential_token "$CTOKEN" >/dev/null 2>&1
printf '  initialised: 50 bps, %ss vesting, min %s\n' "$VESTING_SECS" "$(human $MINIMUM)"

# The confidential token asks its allowlist policy to authorize BOTH sides of a
# deposit. A freshly deployed contract is not on that list, so without this the
# claim fails deep inside the token with a bare #3602.
say "Allowlist both sides of the deposit"
for who in "$CONTRACT" "$INTRO"; do
  stellar contract invoke --id "$ALLOWLIST" --source "$ISSUER_ID" --network "$NETWORK" \
    -- allow --account "$who" --operator "$ISSUER" >/dev/null 2>&1 || true
  printf '  allowed %s\n' "$who"
done

# -------------------------------------------------------------------- fund ---
say "Fund"
stellar contract invoke --id "$USDC" --source "$ISSUER_ID" --network "$NETWORK" \
  -- mint --to "$INVESTOR" --amount "$MINT_USDC" >/dev/null 2>&1
stellar contract invoke --id "$UNIT" --source "$ISSUER_ID" --network "$NETWORK" \
  -- mint --to "$CONTRACT" --amount "$MINT_UNITS" >/dev/null 2>&1
printf '  investor holds %s TUSDC\n' "$(human $MINT_USDC)"
printf '  contract holds %s CSDIF units\n' "$(human $MINT_UNITS)"

# --------------------------------------------------------------- subscribe ---
say "Register the introducer, then subscribe"
stellar contract invoke --id "$CONTRACT" --source "$INTRO_ID" --network "$NETWORK" \
  -- register_introducer --owner "$INTRO" --code "$CODE" \
  --display_name "Raghunathan Family Office" >/dev/null 2>&1
printf '  %s registered\n' "$CODE"

UNITS_BEFORE=$(stellar contract invoke --id "$UNIT" --source "$ISSUER_ID" --network "$NETWORK" \
  -- balance --id "$INVESTOR" 2>/dev/null | tail -1 | tr -d '"')

stellar contract invoke --id "$CONTRACT" --source "$INVESTOR_ID" --network "$NETWORK" \
  -- subscribe --investor "$INVESTOR" --code "$CODE" --usdc_amount "$SUBSCRIBE" >/dev/null 2>&1
printf '  subscribed %s TUSDC through %s\n' "$(human $SUBSCRIBE)" "$CODE"

UNITS_AFTER=$(stellar contract invoke --id "$UNIT" --source "$ISSUER_ID" --network "$NETWORK" \
  -- balance --id "$INVESTOR" 2>/dev/null | tail -1 | tr -d '"')
printf '  investor issued %s CSDIF units this run\n' "$(human $((UNITS_AFTER-UNITS_BEFORE)))"

# ------------------------------------------------------------------ vesting --
say "Wait for the fee to vest"
CLAIMABLE=0
for i in $(seq 1 12); do
  CLAIMABLE=$(stellar contract invoke --id "$CONTRACT" --source "$ISSUER_ID" --network "$NETWORK" \
    -- claimable --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')
  printf '  attempt %-2s claimable = %s\n' "$i" "$(human $CLAIMABLE)"
  [ "$CLAIMABLE" != "0" ] && break
  # Simulations are fast — a dozen of them can finish inside the window, so
  # pace the poll rather than relying on network latency to cover the wait.
  sleep 3
done

# -------------------------------------------------------------------- claim --
say "What the public ledger shows BEFORE the claim"
stellar contract invoke --id "$CONTRACT" --source "$ISSUER_ID" --network "$NETWORK" \
  -- get_ledger 2>/dev/null | tail -1 \
  | python3 -c "import json,sys; r=json.load(sys.stdin)[0]; print(f'  fee is readable by anyone: {int(r[\"fee\"])/10**7:,.2f}  <- public while it vests, which is what lets the issuer recover it')"

commitment() {
  stellar contract invoke --id "$CTOKEN" --source "$ISSUER_ID" --network "$NETWORK" \
    -- confidential_balance --account "$1" 2>/dev/null | tail -1 \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['receiving_commitment'])"
}

say "Claim — the fee moves into the confidential token"
PUB_BEFORE=$(stellar contract invoke --id "$USDC" --source "$ISSUER_ID" --network "$NETWORK" \
  -- balance --id "$INTRO" 2>/dev/null | tail -1 | tr -d '"')
COM_BEFORE=$(commitment "$INTRO")

PAID=$(stellar contract invoke --id "$CONTRACT" --source "$INTRO_ID" --network "$NETWORK" \
  --send=yes -- claim_fee --code "$CODE" 2>/dev/null | tail -1 | tr -d '"')

PUB_AFTER=$(stellar contract invoke --id "$USDC" --source "$ISSUER_ID" --network "$NETWORK" \
  -- balance --id "$INTRO" 2>/dev/null | tail -1 | tr -d '"')
COM_AFTER=$(commitment "$INTRO")

printf '  contract released        %s TUSDC\n' "$(human ${PAID:-0})"
printf '  introducer PUBLIC TUSDC  %s -> %s   (unchanged: it never touches their account)\n' \
  "$(human ${PUB_BEFORE:-0})" "$(human ${PUB_AFTER:-0})"
printf '  NOTE: the deposit event still publishes the amount — deposits are\n'
printf '        public-to-private by design, so this single claim is readable.\n'
printf '        What is confidential from here is the BALANCE:\n'
printf '    before  %s…\n    after   %s…\n' "${COM_BEFORE:0:48}" "${COM_AFTER:0:48}"

# ------------------------------------------------------------------ verdict --
say "Result"
PUB_MOVED=$(( ${PUB_AFTER:-0} - ${PUB_BEFORE:-0} ))
if [ "${PAID:-0}" = "$EXPECT_FEE" ] && [ "$PUB_MOVED" = "0" ] && [ "$COM_BEFORE" != "$COM_AFTER" ]; then
  printf '  \033[32mPASS\033[0m  subscribe -> accrue -> vest -> claim\n'
  printf '        %s TUSDC left the contract, the commitment changed,\n' "$(human $EXPECT_FEE)"
  printf '        and nothing landed in their public balance.\n'
  EXP=https://stellar.expert/explorer/testnet
  printf '\n  See it on chain:\n'
  printf '    contract    %s/contract/%s\n' "$EXP" "$CONTRACT"
  printf '    introducer  %s/account/%s\n' "$EXP" "$INTRO"
  printf '    verifier    %s/contract/%s\n' "$EXP" "$VERIFIER"
else
  printf '  \033[31mFAIL\033[0m  claim returned %s (expected %s); public balance moved %s; commitment changed: %s\n' \
    "$(human ${PAID:-0})" "$(human $EXPECT_FEE)" "$(human $PUB_MOVED)" \
    "$([ "$COM_BEFORE" != "$COM_AFTER" ] && echo yes || echo NO)"
  exit 1
fi
