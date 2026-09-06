#!/usr/bin/env bash
# progress.sh: the transport bar for a walk.
#
#   progress.sh <stop> <total> <lines-left> <claims-left> <inferred-left> [speed]
#
# Prints one line:  [####------] 4/9 - about 12 min left
#
# The estimate is deliberately simple and stated as "about". Careful code
# reading runs near 20 lines a minute; a claim costs thinking time on top, and
# a claim with weak evidence costs more because it is the one worth arguing
# with. Speed scales the whole thing because it changes how much is narrated,
# not how fast anyone reads.
set -euo pipefail

stop="${1:?stop}"; total="${2:?total}"
lines="${3:-0}"; claims="${4:-0}"; inferred="${5:-0}"; speed="${6:-1}"

read -r minutes bar <<EOF
$(awk -v l="$lines" -v c="$claims" -v i="$inferred" -v s="$speed" -v st="$stop" -v t="$total" '
BEGIN {
  if (s <= 0) s = 1
  m = (l / 20.0) + (c * 0.5) + (i * 1.0)
  m = m / s
  if (m > 0 && m < 1) m = 1
  done = (t > 0) ? int((st - 1) * 10 / t) : 0
  bar = ""
  for (n = 0; n < 10; n++) bar = bar (n < done ? "#" : "-")
  printf "%d %s\n", (m + 0.5), bar
}')
EOF

if [ "$minutes" -le 0 ]; then
  printf '[%s] %s/%s - last stop\n' "$bar" "$stop" "$total"
else
  printf '[%s] %s/%s - about %s min left\n' "$bar" "$stop" "$total" "$minutes"
fi
