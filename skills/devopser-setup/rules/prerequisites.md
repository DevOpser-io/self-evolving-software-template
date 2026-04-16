# Prerequisites and pre-flight

Everything that must be true *before* you touch `./scripts/setup.sh`. OS-specific install commands live in [`../../../README.md`](../../../README.md) → **"Installing PostgreSQL and Redis locally"** — link the user there rather than duplicating.

## Non-negotiables

- Do not `sudo chown` anything under `~/.npm` or `~/.aws` without asking the user first.
- Do not silently pick a different port when the default is taken. Stop and tell the user which process owns it.
- Do not paraphrase errors from `./scripts/setup.sh` — it's designed to emit the exact fix command.

## Required tools

| Tool | Version | Why |
|---|---|---|
| Node.js | 20 or 23 LTS | Backend + frontend build |
| npm | bundled | Package manager |
| Docker | any recent | `scripts/setup.sh` starts Postgres + Redis containers |
| PostgreSQL | 14+ | Only needed if you're running Postgres on the host instead of in Docker |
| Redis | 6+ | Only needed if you're running Redis on the host instead of in Docker |
| Git | any | Clone / fork |
| AWS CLI | v2 | Only if `LLM_PROVIDER=bedrock` — used to resolve credentials |

Check versions with `node -v`, `docker --version`, `git --version`. Relay whatever the user reports back verbatim.

## Port pre-flight

Check all three before anything else runs:

```bash
lsof -iTCP:8000 -sTCP:LISTEN
lsof -iTCP:5432 -sTCP:LISTEN
lsof -iTCP:6379 -sTCP:LISTEN
```

- **Empty output** → port is free, proceed.
- **A prior `sest-*` container holds it** → fine, `./scripts/setup.sh` is idempotent and will reuse it.
- **Anything else holds it** → stop. Report the PID and process name to the user. Do not clobber.

If the user explicitly wants to use a different port, re-run with overrides and mirror them in `.env`:

```bash
POSTGRES_PORT=5433 REDIS_PORT=6380 ./scripts/setup.sh
```

## npm cache ownership

A common failure mode: the user previously ran `sudo npm install` somewhere, leaving root-owned files under `~/.npm/_cacache`. The next non-sudo install fails with `EACCES`.

Check before running setup:

```bash
ls -ld ~/.npm/_cacache 2>/dev/null
find ~/.npm/_cacache -maxdepth 2 -user root 2>/dev/null | head -5
```

If root-owned subdirs exist, redirect *this session's* cache instead of chowning:

```bash
npm config set cache ~/.npm-user-cache
```

Do not run `sudo chown -R "$USER" ~/.npm` without asking the user first.

## AWS pre-flight (Bedrock only)

If the user picks `LLM_PROVIDER=bedrock`, confirm their local AWS CLI works **before** editing `.env`:

```bash
aws sts get-caller-identity
```

- **Succeeds** → record the returned `Arn` so you can match it in the server log later. Proceed to [`llm-provider.md`](./llm-provider.md).
- **Fails** → stop and surface the exact error. Do not edit `~/.aws/*` files. Do not invent a profile name.

## Running the bootstrap

```bash
./scripts/setup.sh
```

Idempotent. It validates tool versions, copies `.env.example` → `.env` if missing, starts `sest-postgres` and `sest-redis` via `docker compose`, installs frontend + backend + root dependencies, runs Sequelize migrations via `./run-migrations.sh`, and seeds `admin@example.com` / `adminpass`.

If it fails, **relay the error verbatim** — the script is designed to hand the user a fix command (e.g. `brew install node@20`, `open -a Docker`). Paraphrasing loses the instruction.

## Verification gate

Before proceeding to [`llm-provider.md`](./llm-provider.md), confirm all three:

1. `docker ps` shows `sest-postgres` and `sest-redis` running.
2. `./scripts/setup.sh` exited `0` with no `ERROR` lines at the tail.
3. `.env` exists and is not empty.

If any is false, stop and report.
