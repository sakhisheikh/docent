#!/usr/bin/env bash
# Asserts the plugin is well formed: metadata parses, the skill has the
# frontmatter Claude Code needs, references resolve, and the size limits that
# keep SKILL.md readable still hold.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail() { echo "FAIL: $1"; exit 1; }

python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))"      || fail "plugin.json invalid"
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json'))" || fail "marketplace.json invalid"

# The plugin name must match between the two files, or install resolves nothing.
name_p=$(python3 -c "import json; print(json.load(open('.claude-plugin/plugin.json'))['name'])")
name_m=$(python3 -c "import json; print(json.load(open('.claude-plugin/marketplace.json'))['plugins'][0]['name'])")
[ "$name_p" = "$name_m" ] || fail "plugin name mismatch: $name_p vs $name_m"

skill=skills/docent/SKILL.md
[ -f "$skill" ] || fail "SKILL.md missing"
head -1 "$skill" | grep -q '^---$'          || fail "frontmatter must open on line 1"
grep -q '^name: docent$' "$skill"           || fail "frontmatter name"
grep -q '^description: ' "$skill"           || fail "frontmatter description"

# Every referenced file exists, so the agent never reaches a dead path midwalk.
for ref in references/evidence.md references/artifact-style.md references/state.md \
           templates/reading-order.md templates/claims.md templates/post.md \
           scripts/facts.sh scripts/show.sh scripts/progress.sh scripts/annotate.sh; do
  [ -f "skills/docent/$ref" ] || fail "missing $ref"
  grep -q "$(basename "$ref")" "$skill" || fail "$ref exists but SKILL.md never points at it"
done

for x in facts.sh show.sh progress.sh annotate.sh; do
  [ -x "skills/docent/scripts/$x" ] || fail "$x not executable"
done

# Size limits: a skill nobody finishes reading does not get followed.
lines=$(wc -l < "$skill")
[ "$lines" -lt 250 ] || fail "SKILL.md is $lines lines, limit 250"
for r in skills/docent/references/*.md; do
  n=$(wc -l < "$r")
  [ "$n" -lt 120 ] || fail "$r is $n lines, limit 120"
done

# The extension is part of the product, so its manifest and entry point are
# checked here rather than discovered broken at install time.
[ -f editor/vscode/package.json ] || fail "extension manifest missing"
[ -f editor/vscode/extension.js ] || fail "extension entry point missing"
python3 -c "import json; json.load(open('editor/vscode/package.json'))" || fail "extension manifest invalid"
node --check editor/vscode/extension.js 2>/dev/null || fail "extension.js does not parse"
grep -q "tour.json" "$skill" || fail "SKILL.md never mentions tour.json"

# Webview APIs live on panel.webview, not on the panel. Getting this wrong
# throws at runtime before any HTML is written, and node --check cannot see it.
ext=editor/vscode/extension.js
for api in onDidReceiveMessage postMessage asWebviewUri; do
  grep -qE "panel\.$api" "$ext" && fail "panel.$api should be panel.webview.$api"
done
# And these live on the panel, not the webview.
for api in onDidDispose reveal dispose; do
  grep -qE "panel\.webview\.$api" "$ext" && fail "panel.webview.$api should be panel.$api"
done
# A scripted webview needs enableScripts, or the transport is inert.
grep -q "enableScripts: true" "$ext" || fail "webview scripts disabled, transport would not respond"
grep -q "acquireVsCodeApi" "$ext"    || fail "webview never acquires the api"
grep -q "docent.play" editor/vscode/package.json || fail "play command not contributed"

# A tour is repo content, so its text must never be parsed as a shell command
# or as an option to the speech binary.
grep -qE "spawn\(.*shell" "$ext" && fail "speech must not run through a shell"
grep -q "'--', text" "$ext" || fail "speech text must follow -- so a leading dash stays text"
grep -q "docent.voice" editor/vscode/package.json || fail "voice toggle not contributed"

# The release pipeline is the thing nobody notices is broken until a release.
# These are the two mistakes that ship the wrong bytes under the right name.
rel=.github/workflows/release.yml
[ -f "$rel" ] || fail "release workflow missing"
grep -q "does not match package.json" "$rel" || fail "release must fail when the tag and manifest disagree"
grep -q -- "--packagePath" "$rel" || fail "publish the packaged vsix, not a fresh build, so every registry gets the same bytes"
grep -q "env.VSCE_PAT != ''" "$rel" || fail "a missing marketplace token must skip, not fail the release"
grep -q "env.OVSX_TOKEN != ''" "$rel" || fail "a missing Open VSX token must skip, not fail the release"
[ -x scripts/release.sh ] || fail "release.sh not executable"

# One release, one version. The extension and the plugin ship from the same
# commit, so a reader who sees 0.9.1 in one and 0.9.0 in the other cannot tell
# which is the release.
ver_x=$(node -p "require('./editor/vscode/package.json').version")
ver_p=$(node -p "require('./.claude-plugin/plugin.json').version")
[ "$ver_x" = "$ver_p" ] || fail "version drift: extension $ver_x, plugin $ver_p"
grep -q 'plugin=.claude-plugin/plugin.json' scripts/release.sh || fail "release.sh must bump the plugin version too"

echo "ok: plugin_test"
