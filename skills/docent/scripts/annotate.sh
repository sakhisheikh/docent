#!/usr/bin/env bash
# annotate.sh: write the walk into the author's editor, inline with the code.
#
#   annotate.sh <file> <notes>
#
# notes is a plain text file of "line|comment" pairs, one per line:
#
#   28|the gate lives here, nothing above this knows about a stream
#   55|these two are enumerated by the device, the third is invented here
#
# The comment is appended to the end of that line in a scratch copy, so line
# numbers stay identical to the original. The copy opens as a diff against the
# real file: the code sits on the left, the same code with the walk written
# into it on the right, and the editor's own change highlighting points at
# exactly the lines being discussed.
#
# The original file is never touched.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
file="${1:?usage: annotate.sh <file> <notes>}"
notes="${2:?usage: annotate.sh <file> <notes>}"
[ -f "$file" ]  || { echo "no such file: $file" >&2; exit 1; }
[ -f "$notes" ] || { echo "no such notes file: $notes" >&2; exit 1; }

# Comment syntax by extension, so the annotated copy still highlights as code.
case "${file##*.}" in
  go|js|ts|tsx|jsx|java|c|h|cc|cpp|hpp|rs|swift|kt|scala|php|cs|m|mm) c="//" ;;
  py|sh|bash|zsh|rb|pl|yaml|yml|toml|tf|r|jl)                          c="#"  ;;
  sql|lua|hs|elm|ada)                                                  c="--" ;;
  lisp|clj|el)                                                         c=";;" ;;
  *)                                                                   c="//" ;;
esac

out="${TMPDIR:-/tmp}/docent-walk-$(basename "$file")"

awk -v notes="$notes" -v c="$c" '
BEGIN {
  while ((getline nl < notes) > 0) {
    if (nl ~ /^[0-9]+\|/) {
      i = index(nl, "|")
      n = substr(nl, 1, i - 1) + 0
      t = substr(nl, i + 1)
      note[n] = (n in note) ? note[n] "  " t : t
    }
  }
}
{
  if (FNR in note) printf "%s  %s %s %s\n", $0, c, "<<", note[FNR]
  else print
}' "$file" > "$out"

if [ "${TERM_PROGRAM:-}" = "vscode" ] && command -v code >/dev/null 2>&1; then
  code -r -d "$file" "$out"
  echo "annotated: $file (walk on the right, your code on the left, untouched)"
elif command -v cursor >/dev/null 2>&1; then
  cursor -r -d "$file" "$out"
  echo "annotated: $file (walk on the right, your code on the left, untouched)"
else
  echo "no editor detected; annotated copy is at $out"
fi
