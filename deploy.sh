#!/bin/bash
# Deploy BeetleBoy SP to beetle.sevensevenseven.net.
# Bumps the cache version (index.html ?v= and APP_VERSION in js/core.js),
# commits that bump, then syncs. uploads/ (images people posted) is never touched.
set -euo pipefail
cd "$(dirname "$0")"
REMOTE='ssh300010381@ngcobalt438.manitu.net:/home/sites/site100039010/web/beetle.sevensevenseven.net/'
if [ -n "$(git status --porcelain)" ]; then echo "Commit your changes first."; exit 1; fi
V=$(date +%Y%m%d%H%M)
sed -i -E "s/\?v=[0-9a-z]+\"/?v=$V\"/g" index.html
sed -i -E "s/const APP_VERSION = '[^']*'/const APP_VERSION = '$V'/" js/core.js
git commit -qam "Deploy $V"
rsync -az --delete --omit-dir-times \
  --exclude=.git --exclude=.gitignore --exclude=tool.py --exclude=deploy.sh --exclude=gen_assets.py \
  --exclude='*.bak' --exclude=__pycache__/ --exclude=data/ --exclude=uploads/ --exclude=devlogin.html \
  ./ "$REMOTE" 2>&1 | grep -v 'failed to set permissions\|code 23' || true
echo "Deployed $V"
