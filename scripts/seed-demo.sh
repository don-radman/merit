#!/usr/bin/env bash
#
# Seed a demo-ready deployment on testnet.
#
#   ./scripts/seed-demo.sh
#
# e2e-testnet.sh proves the privacy property and throws its instance away. This
# script does the other job: it leaves a deployment whose book shows all four
# states at once, so the UI has something real to render and the video has
# something real to show.
#
# The ordering below is forced by the contract, not chosen:
#
#   * recover() refuses a vested row (NotRecoverable), so the clawback has to
#     happen BEFORE the wait.
#   * claim() takes EVERY vested row for a code in one call, so a code cannot
#     hold a claimed row and a claimable row unless they vested either side of
#     a claim. Hence two waits.
#
# That is why CALDER-PR7 ends up with all four states and the window is 300s:
# long enough that a subscribe on camera still reads "vesting" for the whole
# video, short enough that seeding is ten minutes and not ten days.
#
# Production would set the window to 90 days (DECISIONS.md D9). Nothing about
# the contract changes — it is an initialise argument.

set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"

NETWORK=testnet
ISSUER_ID=ir-issuer
INTRO_ID=ir-introducer           # CALDER-PR7
INTRO2_ID=ir-introducer2         # CALDER-DO2
INVESTOR_ID=ir-investor

VESTING_SECS=300
MINIMUM=500000000000             #    50,000.0000000
MINT=40000000000000              # 4,000,000.0000000 — covers the seed and the demo

SUB_CLAIMED=2500000000000        #   250,000.0000000  -> PR7, claimed
SUB_RECOVER=1800000000000        #   180,000.0000000  -> PR7, clawed back
SUB_DO2=4000000000000            #   400,000.0000000  -> DO2, claimed
SUB_CLAIMABLE=10000000000000     # 1,000,000.0000000  -> PR7, vested and unclaimed

say()   { printf '\n\033[1m── %s\033[0m\n' "$*"; }
human() { python3 -c "print(f'{int($1)/10**7:,.2f}')"; }
call()  { stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" "${@:3}"; }

ISSUER=$(stellar keys address "$ISSUER_ID")
INTRO=$(stellar keys address "$INTRO_ID")
INTRO2=$(stellar keys address "$INTRO2_ID")
INVESTOR=$(stellar keys address "$INVESTOR_ID")
USDC=$(grep '^USDC_SAC=' .contract-id | cut -d= -f2)
UNIT=$(grep '^UNIT_SAC=' .contract-id | cut -d= -f2)

say "Deploy"
CONTRACT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/introducer_rails.wasm \
  --source "$ISSUER_ID" --network "$NETWORK" 2>/dev/null | tail -1)
printf '  %s\n' "$CONTRACT"

call "$CONTRACT" "$ISSUER_ID" -- initialise --issuer "$ISSUER" --usdc "$USDC" \
  --unit "$UNIT" --vesting_window_secs "$VESTING_SECS" --minimum "$MINIMUM" >/dev/null 2>&1
printf '  %ss vesting, minimum %s, no rate stored\n' "$VESTING_SECS" "$(human $MINIMUM)"

say "Fund"
call "$USDC" "$ISSUER_ID" -- mint --to "$INVESTOR" --amount "$MINT" >/dev/null 2>&1
call "$UNIT" "$ISSUER_ID" -- mint --to "$CONTRACT" --amount "$MINT" >/dev/null 2>&1
printf '  investor %s TUSDC, contract %s CSDIF\n' "$(human $MINT)" "$(human $MINT)"

say "Register both introducers"
call "$CONTRACT" "$INTRO_ID" -- register_introducer --owner "$INTRO" \
  --code CALDER-PR7 --display_name "Raghunathan Family Office" >/dev/null 2>&1
call "$CONTRACT" "$INTRO2_ID" -- register_introducer --owner "$INTRO2" \
  --code CALDER-DO2 --display_name "Dorsey Oakes Partners" >/dev/null 2>&1
# Two codes on deliberately different terms. The chain cannot tell them apart,
# which is the point: grep the ledger and no rate appears for either.
#
# The rates are READ from the gitignored file rather than written here. This
# script is committed, and a rate restated in a comment is a rate published —
# which is how `rates.example.json` came to ship with the live values in it.
if [ -f contracts/rates.json ]; then
  python3 -c "
import json
d = json.load(open('contracts/rates.json'))
codes = [k for k in d if not k.startswith('_')]
print('  %d codes on %d distinct rates, none of them on chain'
      % (len(codes), len({d[k] for k in codes})))
"
else
  printf '  contracts/rates.json absent — settlement will not run\n'
fi

# subscribe returns the whole Attribution, so pull the id out rather than
# trusting the last line to be a scalar.
sub() {  # sub <code> <amount> -> prints the new id
  call "$CONTRACT" "$INVESTOR_ID" --send=yes -- subscribe \
    --investor "$INVESTOR" --code "$1" --usdc_amount "$2" 2>/dev/null \
    | tail -1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])'
}

say "Subscribe the rows that need to vest"
ID_CLAIMED=$(sub CALDER-PR7 "$SUB_CLAIMED")
ID_DO2=$(sub CALDER-DO2 "$SUB_DO2")
ID_RECOVER=$(sub CALDER-PR7 "$SUB_RECOVER")
printf '  id %-3s PR7 %s\n  id %-3s DO2 %s\n  id %-3s PR7 %s\n' \
  "$ID_CLAIMED" "$(human $SUB_CLAIMED)" "$ID_DO2" "$(human $SUB_DO2)" \
  "$ID_RECOVER" "$(human $SUB_RECOVER)"

say "Claw back id $ID_RECOVER while it is still inside the window"
call "$CONTRACT" "$ISSUER_ID" --send=yes -- recover --id "$ID_RECOVER" >/dev/null 2>&1
printf '  recovered — the investor redeemed early, so this one never settles\n'

say "Wait ${VESTING_SECS}s for the first rows to vest"
sleep $((VESTING_SECS + 10))

say "Claim both codes"
printf '  PR7 claimed %s introduction(s)\n' \
  "$(call "$CONTRACT" "$INTRO_ID" --send=yes -- claim --code CALDER-PR7 2>/dev/null | tail -1 | tr -d '"')"
printf '  DO2 claimed %s introduction(s)\n' \
  "$(call "$CONTRACT" "$INTRO2_ID" --send=yes -- claim --code CALDER-DO2 2>/dev/null | tail -1 | tr -d '"')"

say "Subscribe the row that will be claimable at demo time"
ID_CLAIMABLE=$(sub CALDER-PR7 "$SUB_CLAIMABLE")
printf '  id %-3s PR7 %s\n' "$ID_CLAIMABLE" "$(human $SUB_CLAIMABLE)"

say "Wait ${VESTING_SECS}s for it to vest, unclaimed"
sleep $((VESTING_SECS + 10))

say "Final state"
printf '  CALDER-PR7 claimable basis %s\n' \
  "$(human "$(call "$CONTRACT" "$ISSUER_ID" -- claimable_basis --code CALDER-PR7 2>/dev/null | tail -1 | tr -d '"')")"
call "$CONTRACT" "$ISSUER_ID" -- get_ledger 2>/dev/null | tail -1 | python3 -c "
import json,sys
for r in json.load(sys.stdin):
    state = ('recovered' if r['recovered'] else
             'claimed'   if r['claimed'] else
             'claimable' if r['vests_at'] <= __import__('time').time() else 'vesting')
    print(f\"  id {r['id']:<3} {r['code']:<11} {int(r['subscribed'])/10**7:>14,.2f}  {state}\")
"

say "Point the UI at it"
printf '  VITE_CONTRACT_ID=%s\n' "$CONTRACT"
printf '\n  A subscribe during the demo stays "vesting" for %ss.\n' "$VESTING_SECS"
