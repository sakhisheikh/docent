#!/usr/bin/env bash
# The annotated copy must preserve line numbers and never touch the original.
set -euo pipefail
script="$(cd "$(dirname "$0")/.." && pwd)/skills/docent/scripts/annotate.sh"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $1"; exit 1; }

cd "$tmp"; git init -q; git config user.email t@t; git config user.name t
printf 'package main\n\nfunc a() {\n\treturn\n}\n' > f.go
printf '3|the decision lives here\n1|package doc\n' > notes.txt
before=$(md5 -q f.go 2>/dev/null || md5sum f.go | cut -d' ' -f1)

out=$(TERM_PROGRAM= "$script" f.go notes.txt)
copy="${TMPDIR:-/tmp}/docent-walk-f.go"

[ "$(wc -l < f.go)" = "$(wc -l < "$copy")" ] || fail "line count changed, numbers would not align"
grep -q '^func a() {  // << the decision lives here$' "$copy" || fail "note not appended at line 3"
grep -q '^package main  // << package doc$'          "$copy" || fail "note not appended at line 1"
after=$(md5 -q f.go 2>/dev/null || md5sum f.go | cut -d' ' -f1)
[ "$before" = "$after" ] || fail "the original file was modified"

# Comment syntax follows the language, or the copy stops being valid code.
printf 'x = 1\n' > f.py; printf '1|a note\n' > n2.txt
TERM_PROGRAM= "$script" f.py n2.txt >/dev/null
grep -q '^x = 1  # << a note$' "${TMPDIR:-/tmp}/docent-walk-f.py" || fail "python comment syntax"

echo "ok: annotate_test"
