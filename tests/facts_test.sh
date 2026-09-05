#!/usr/bin/env bash
# Builds a throwaway repo with a known change shape and asserts facts.sh output.
set -euo pipefail

script="$(cd "$(dirname "$0")/.." && pwd)/skills/docent/scripts/facts.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $1"; echo "---- output ----"; echo "$out"; exit 1; }

cd "$tmp"
git init -q -b main
git config user.email t@t; git config user.name t
mkdir -p src docs vendor/dep tests
echo base > src/a.go
git add -A && git commit -qm base

git checkout -qb feature
printf 'l1\nl2\nl3\n'   > src/a.go            # 3 added, 1 deleted (source)
printf 'x\n'            > src/a_test.go        # test by suffix
printf 'x\n'            > tests/e2e.sh         # test by dir
printf 'x\n'            > docs/note.md         # doc
printf 'x\n'            > vendor/dep/lib.go    # generated
printf '\x00\x01'       > src/blob.bin         # binary
git add -A && git commit -qm feature

out=$("$script" main)

echo "$out" | grep -q "^HEAD    $(git rev-parse HEAD)$"      || fail "HEAD sha"
echo "$out" | grep -q "^BASE    main ($(git merge-base main HEAD))$" || fail "merge base"
echo "$out" | grep -q "REMOTE  (none)"                        || fail "remote none"
echo "$out" | grep -Eq "3      1        source     src/a.go"  || fail "source counts"
echo "$out" | grep -Eq "test       src/a_test.go"             || fail "test by suffix"
echo "$out" | grep -Eq "test       tests/e2e.sh"              || fail "test by dir"
echo "$out" | grep -Eq "doc        docs/note.md"              || fail "doc kind"
echo "$out" | grep -Eq "generated  vendor/dep/lib.go"         || fail "vendor kind"
echo "$out" | grep -Eq "binary     src/blob.bin"              || fail "binary kind"
echo "$out" | grep -q  "TOTALS  6 files"                      || fail "totals"

# ssh remote is normalised to https
git remote add origin git@github.com:someone/thing.git
out=$("$script" main)
echo "$out" | grep -q "REMOTE  https://github.com/someone/thing$" || fail "remote normalised"

echo "ok: facts_test"
