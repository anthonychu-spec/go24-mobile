#!/bin/bash
# Deploy GO24 Mobile App
# Usage: bash deploy.sh
#
# TODO: Fill in server details and build steps when deployment target is ready.

set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}✗${NC} $*"; exit 1; }

PROJECT_NAME="Mobile App"

# ─── 1. TYPECHECK ────────────────────────────────────────────────────────────
echo ""
echo "=== [1/3] Typecheck ==="
pnpm typecheck 2>&1 && ok "TypeScript clean" || die "Typecheck failed"

# ─── 2. COMMIT + PUSH ────────────────────────────────────────────────────────
echo ""
echo "=== [2/3] Commit + push ==="
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo "$DIRTY"
  read -r -p "Commit message (blank to abort): " COMMIT_MSG
  [ -z "$COMMIT_MSG" ] && die "Aborted"
  git add -A
  git commit -m "$COMMIT_MSG" || die "Commit failed"
  ok "Committed"
fi
git push origin main && ok "Pushed"

# ─── 3. BUILD + DEPLOY ───────────────────────────────────────────────────────
echo ""
echo "=== [3/3] Deploy ==="
SSH_KEY="$HOME/.ssh/go24_droplet"
SSH_HOST="root@api-staging.go24fitness.com"
REMOTE_CMD="cd /opt/go24 && git pull && docker compose -f infra/droplet/docker-compose.prod.yml up -d --build api"

if [ ! -f "$SSH_KEY" ]; then
  die "SSH key not found: $SSH_KEY"
fi

echo "Connecting to $SSH_HOST..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_HOST" "$REMOTE_CMD" \
  && ok "API deployed" \
  || die "Deploy failed — check server logs"

echo ""
ok "✅ $PROJECT_NAME — deployed to staging"

# ─── UPDATE OBSIDIAN ─────────────────────────────────────────────────────────
echo ""
echo "=== Updating Obsidian notes ==="
PROJECT_OBSIDIAN_DIR="G:/My Drive/Obsidian/Anthony's/Mobile App" \
PROJECT_NAME="Mobile App" \
bash "C:/Users/LENOVO/Documents/hrms/scripts/update-obsidian.sh" \
  && ok "Obsidian notes updated" || warn "Obsidian update failed (non-fatal)"
