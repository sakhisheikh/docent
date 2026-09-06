#!/usr/bin/env bash
# The estimate is user-facing arithmetic, so it gets asserted.
set -euo pipefail
p="$(cd "$(dirname "$0")/.." && pwd)/skills/docent/scripts/progress.sh"
fail() { echo "FAIL: $1"; exit 1; }

# 1027 lines at 20/min = 51, +14 claims at 0.5 = 7, +3 weak at 1.0 = 3 -> 61
[ "$("$p" 1 5 1027 14 3)" = "[----------] 1/5 - about 61 min left" ] || fail "baseline estimate"
# 2x halves the narration, so it halves the estimate
[ "$("$p" 1 5 1027 14 3 2)" = "[----------] 1/5 - about 31 min left" ] || fail "2x"
# the bar fills with progress
"$p" 5 5 90 2 1 | grep -q '^\[########--\] 5/5' || fail "bar fill"
# nothing left to read is stated plainly, not as "about 0 min"
"$p" 5 5 0 0 0 | grep -q 'last stop' || fail "zero case"
# a guard against divide by zero on a bad speed
"$p" 1 5 100 0 0 0 | grep -q 'min left' || fail "zero speed guard"
echo "ok: progress_test"
