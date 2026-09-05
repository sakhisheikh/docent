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
           scripts/facts.sh; do
  [ -f "skills/docent/$ref" ] || fail "missing $ref"
  grep -q "$(basename "$ref")" "$skill" || fail "$ref exists but SKILL.md never points at it"
done

[ -x skills/docent/scripts/facts.sh ] || fail "facts.sh not executable"

# Size limits: a skill nobody finishes reading does not get followed.
lines=$(wc -l < "$skill")
[ "$lines" -lt 250 ] || fail "SKILL.md is $lines lines, limit 250"
for r in skills/docent/references/*.md; do
  n=$(wc -l < "$r")
  [ "$n" -lt 120 ] || fail "$r is $n lines, limit 120"
done

echo "ok: plugin_test"
