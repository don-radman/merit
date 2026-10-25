#!/usr/bin/env bash
#
# Repo hygiene for the one value this design is built to protect.
#
#   ./scripts/check-secrets.sh
#
# e2e-testnet.sh asserts the CHAIN leaks no rate. This asserts the REPO does
# not hand one over instead, which is the cheaper way to lose the argument:
# `rates.example.json` was once committed byte-identical to the live
# `rates.json`, complete with a comment calling itself the secret.
#
# Deliberately narrow. `src/lib/fixtures.ts` also maps codes to rates and is
# committed on purpose — it is openly demo data for a fictional fund, and a
# demo has to put numbers somewhere. The rule enforced here is only that the
# file which exists to be copied never carries the values it is copied from.

set -euo pipefail
cd "$(dirname "$0")/.."

LIVE=contracts/rates.json
EXAMPLE=contracts/rates.example.json
fail=0

note() { printf '  %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; fail=1; }

printf '\n\033[1m── Secrets\033[0m\n'

if git ls-files --error-unmatch "$LIVE" >/dev/null 2>&1; then
  bad "$LIVE is tracked by git — it holds the live rates and must not be"
else
  note "$LIVE is untracked"
fi

if [ ! -f "$EXAMPLE" ]; then
  bad "$EXAMPLE is missing"
elif [ ! -f "$LIVE" ]; then
  note "$LIVE absent, nothing to compare the template against"
elif cmp -s "$EXAMPLE" "$LIVE"; then
  bad "$EXAMPLE is byte-identical to $LIVE — the template is publishing the secret"
else
  # Sharing a key is enough: the template would then carry a live code, and a
  # matching value under it would carry that introducer's terms.
  shared=$(python3 - "$EXAMPLE" "$LIVE" <<'PY'
import json, sys
ex, live = (json.load(open(p)) for p in sys.argv[1:3])
keys = lambda d: {k for k in d if not k.startswith('_')}
print(' '.join(sorted(keys(ex) & keys(live))))
PY
)
  if [ -n "$shared" ]; then
    bad "$EXAMPLE shares live introducer codes with $LIVE: $shared"
  else
    note "$EXAMPLE shares no code with $LIVE"
  fi
fi

# The values themselves must not appear in any tracked file under contracts/,
# where everything is about the chain and nothing has a reason to know a rate.
if [ -f "$LIVE" ]; then
  while read -r code bps; do
    [ -z "$code" ] && continue
    hits=$(git grep -l -F "\"$code\": $bps" -- contracts/ 2>/dev/null || true)
    [ -n "$hits" ] && bad "live rate for $code appears in tracked: $hits"
  done < <(python3 -c "
import json;d=json.load(open('$LIVE'))
[print(k,v) for k,v in d.items() if not k.startswith('_')]
")
  [ $fail -eq 0 ] && note "no live code/rate pair in tracked contracts/ files"
fi

printf '\n'
if [ $fail -ne 0 ]; then
  printf '\033[31m  secrets check FAILED\033[0m\n\n'
  exit 1
fi
printf '\033[32m  secrets check passed\033[0m\n\n'
