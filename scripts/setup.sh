#!/usr/bin/env bash
#
# scripts/setup.sh — one-command local bootstrap for the Self-Evolving
# Software Template.
#
# What this does (idempotent — safe to re-run):
#   1. Checks Node.js >= 20 and Docker are available
#   2. Creates .env from .env.example if missing
#   3. Starts Postgres + Redis via docker compose (waits for healthchecks)
#   4. Installs npm dependencies (root + frontend + backend)
#   5. Runs Sequelize migrations against the local database
#   6. Seeds the default admin user (admin@example.com / adminpass)
#
# After this script finishes, set your LLM credentials in .env and run one of:
#   npm run dev                                 # develop with hot reload
#   docker compose --profile app up -d --build  # run the whole app in Docker
#
# Port conflicts?  Override before running:
#   POSTGRES_PORT=5433 REDIS_PORT=6380 ./scripts/setup.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\n\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
say "Checking prerequisites"

if ! command -v node >/dev/null 2>&1; then
  die "node not found on PATH. Install Node 20+ (https://nodejs.org/ or 'brew install node@20' on macOS)."
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node $(node -v) is too old — this template needs Node >= 20. On macOS:
    brew install node@20
    export PATH=\"\$(brew --prefix node@20)/bin:\$PATH\""
fi
ok "node $(node -v)"

if ! command -v docker >/dev/null 2>&1; then
  die "docker not found on PATH. Install Docker Desktop or Docker Engine and retry."
fi
if ! docker info >/dev/null 2>&1; then
  die "Docker daemon not reachable. Start Docker Desktop (or 'sudo systemctl start docker' on Linux) and retry."
fi
ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin not found. Update Docker Desktop or install docker-compose-plugin."
fi
ok "docker compose $(docker compose version --short 2>/dev/null || echo installed)"

# ---------------------------------------------------------------------------
# 2. .env
# ---------------------------------------------------------------------------
say "Preparing .env"
if [ ! -f .env ]; then
  cp .env.example .env
  ok "created .env from .env.example"
  warn "set OPENAI_API_KEY / ANTHROPIC_API_KEY — or configure Bedrock — before using the chat UI"
else
  ok ".env already exists — leaving it alone"
fi

# ---------------------------------------------------------------------------
# 3. Data services
# ---------------------------------------------------------------------------
say "Starting Postgres and Redis (docker compose)"
docker compose up -d --wait postgres redis
ok "postgres + redis are healthy"

# ---------------------------------------------------------------------------
# 4. Node dependencies
# ---------------------------------------------------------------------------
say "Installing npm dependencies (root + frontend + backend)"
npm run install:all
ok "dependencies installed"

# ---------------------------------------------------------------------------
# 5. Migrations
# ---------------------------------------------------------------------------
say "Running Sequelize migrations"
(cd backend && npx sequelize-cli db:migrate)
ok "migrations applied"

# ---------------------------------------------------------------------------
# 6. Admin seed (idempotent — logs "already exists" on re-runs)
# ---------------------------------------------------------------------------
say "Seeding default admin user"
if node backend/scripts/init-admin-users.js 2>&1 | tee /tmp/sest-admin-seed.log; then
  ok "admin user ready"
else
  if grep -qi "already exists" /tmp/sest-admin-seed.log; then
    ok "admin user already exists (safe)"
  else
    warn "admin seed reported an error — check /tmp/sest-admin-seed.log"
  fi
fi

# ---------------------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------------------
cat <<'EOF'

==========================================================================
Setup complete.

Next steps:
  1. Set your LLM credentials in .env:
       - OPENAI_API_KEY=sk-...                   (simplest)
       - ANTHROPIC_API_KEY=sk-ant-...            (direct Claude API)
       - LLM_PROVIDER=bedrock + AWS creds        (requires Bedrock access)

  2. Start the app:
       npm run dev                                  # hot-reload dev server
       docker compose --profile app up -d --build   # fully containerized

  3. Open http://localhost:8000 and sign in with:
       email:    admin@example.com
       password: adminpass

Bedrock + MFA-protected IAM users: export a session before starting the app:
  eval "$(AWS_PROFILE=<your-mfa-profile> aws configure export-credentials --format env)"
  npm run dev     # (or re-run docker compose with the same shell)

Port conflicts: override POSTGRES_PORT / REDIS_PORT / APP_PORT in your shell
before `docker compose up` or `./scripts/setup.sh`.
==========================================================================
EOF
