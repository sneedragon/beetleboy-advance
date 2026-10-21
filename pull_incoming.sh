#!/bin/bash
# Fetch newly collected items (images + card data) from the server for review. Read-only on the server.
set -euo pipefail
OUT="${1:-$HOME/agent/work/beetleboy-incoming}"
mkdir -p "$OUT"
rsync -az ssh300010381@ngcobalt438.manitu.net:/home/sites/site100039010/beetleboy-private/incoming/ "$OUT/"
ls -1 "$OUT"
