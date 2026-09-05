#!/usr/bin/env bash
# facts.sh: deterministic facts about the change docent will walk.
# Usage: facts.sh [base-ref]
# Output is aligned plain text for a model to read. No semantic judgement
# happens here; deciding which lines carry decisions is the skill's job.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

head_sha=$(git rev-parse HEAD)

# Base: the argument if given, else the first of these that exists.
base_ref="${1:-}"
if [ -z "$base_ref" ]; then
  for candidate in origin/main main origin/master master; do
    if git rev-parse --verify -q "$candidate" >/dev/null; then
      base_ref="$candidate"
      break
    fi
  done
fi
if [ -z "$base_ref" ]; then
  echo "ERROR no base ref found; pass one: facts.sh <base>" >&2
  exit 1
fi
merge_base=$(git merge-base "$base_ref" HEAD)

# Remote, normalised to https for permalinks. Absent remotes are fine;
# permalinks then degrade to path:line references.
remote=$(git remote get-url origin 2>/dev/null || true)
case "$remote" in
  git@*) remote=$(echo "$remote" | sed -E 's#^git@([^:]+):#https://\1/#; s#\.git$##') ;;
  http*) remote=${remote%.git} ;;
esac

echo "REPO    $(pwd)"
echo "HEAD    $head_sha"
echo "BASE    $base_ref ($merge_base)"
echo "REMOTE  ${remote:-(none)}"
echo
echo "FILES   added  deleted  kind       path   (renames appear as old => new)"

git diff --numstat "$merge_base"...HEAD | awk -F'\t' '
function kind(p) {
  if (p ~ /(^|\/)vendor\//                    ) return "generated"
  if (p ~ /(^|\/)node_modules\//              ) return "generated"
  if (p ~ /\.(pb\.go|min\.js|lock)$/          ) return "generated"
  if (p ~ /(^|\/)(package-lock\.json|go\.sum)$/) return "generated"
  if (p ~ /_test\.|(^|\/)tests?\/|\.spec\./   ) return "test"
  if (p ~ /(^|\/)testdata\//                  ) return "test"
  if (p ~ /\.(md|rst|txt)$|(^|\/)docs?\//     ) return "doc"
  return "source"
}
{
  add=$1; del=$2; path=$3
  k = (add=="-") ? "binary" : kind(path)
  if (add=="-") { add=0; del=0 }
  printf "        %-6s %-8s %-10s %s\n", add, del, k, path
  tot_add+=add; tot_del+=del; n++
  by[k"_files"]++; by[k"_add"]+=add
}
END {
  printf "\nTOTALS  %d files, +%d -%d\n", n, tot_add, tot_del
  for (k in by) if (k ~ /_files$/) {
    split(k, a, "_"); printf "        %-10s %d files, +%d\n", a[1], by[k], by[a[1]"_add"]
  }
}'
