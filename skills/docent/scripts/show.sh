#!/usr/bin/env bash
# show.sh: point the author's editor at what is being discussed.
#
#   show.sh <file> <line>          open there, cursor on the line
#   show.sh --diff <file> <base>   side by side against the base revision
#
# Always reuses the window, so the walk moves one editor rather than opening
# a pile of them. Exits 0 with a note when no editor is detected: a walk must
# never fail because the author is in a plain terminal.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

editor=""
if [ "${TERM_PROGRAM:-}" = "vscode" ] && command -v code >/dev/null 2>&1; then
  editor=code
elif command -v cursor >/dev/null 2>&1; then
  editor=cursor
fi

if [ -z "$editor" ]; then
  echo "no editor detected; use the permalink"
  exit 0
fi

if [ "${1:-}" = "--diff" ]; then
  file="$2"
  base="${3:-}"
  [ -n "$base" ] || { echo "usage: show.sh --diff <file> <base-sha>" >&2; exit 1; }

  # The base version has to exist on disk for a diff view. Keep the basename
  # so the editor tab is readable, and mark it as the base.
  tmp="${TMPDIR:-/tmp}/docent-base-$(basename "$file")"
  if git show "$base:$file" > "$tmp" 2>/dev/null; then
    "$editor" -r -d "$tmp" "$file"
    echo "diff opened: $file against $base"
  else
    # New file: nothing to compare against, so just show it.
    "$editor" -r -g "$file:1"
    echo "opened (new in this change): $file"
  fi
  exit 0
fi

file="$1"
line="${2:-1}"
"$editor" -r -g "$file:$line"
echo "opened: $file:$line"
