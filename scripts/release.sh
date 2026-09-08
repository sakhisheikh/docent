#!/usr/bin/env bash
# Cuts a release: bumps the extension version, commits, tags and pushes. The
# push is what triggers .github/workflows/release.yml, which does the rest.
#
#   scripts/release.sh patch | minor | major | <exact version>
set -euo pipefail

cd "$(dirname "$0")/.."
manifest=editor/vscode/package.json

[ $# -eq 1 ] || { echo "usage: $0 patch|minor|major|<version>"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree is dirty, commit first"; exit 1; }
[ "$(git branch --show-current)" = "main" ] || { echo "release from main"; exit 1; }

current=$(node -p "require('./$manifest').version")
case "$1" in
  patch|minor|major)
    next=$(node -e "
      const [a,b,c] = '$current'.split('.').map(Number)
      const n = {patch:[a,b,c+1], minor:[a,b+1,0], major:[a+1,0,0]}['$1']
      console.log(n.join('.'))")
    ;;
  *) next="$1" ;;
esac

# The tag is the source of truth in CI, so the manifest has to agree with it
# before the tag exists, not after.
node -e "
  const fs=require('fs'), p='$manifest'
  const d=JSON.parse(fs.readFileSync(p))
  d.version='$next'
  fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n')"

./tests/run.sh

echo
echo "$current -> $next"
read -rp "tag v$next and push? [y/N] " ok
[ "$ok" = "y" ] || { git checkout -- "$manifest"; echo "aborted"; exit 1; }

git add "$manifest"
git commit -q -m "Release v$next"
git tag -a "v$next" -m "v$next"
git push -q origin main "v$next"

echo "pushed. the release workflow is running:"
echo "  https://github.com/sakhisheikh/docent/actions"
