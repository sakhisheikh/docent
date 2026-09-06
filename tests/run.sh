#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for t in facts_test.sh progress_test.sh annotate_test.sh plugin_test.sh; do ./"$t"; done
echo "all tests passed"
