# Troubleshooting

Expanded version of [`../../../README.md`](../../../README.md) → **"Troubleshooting"**, with the symptoms forkers hit once they start customizing. See [`../../../AGENTS.md`](../../../AGENTS.md) for authoritative diagnostics when these point at template internals.

## Non-negotiables

- **Relay errors verbatim** — do not paraphrase stack traces, `AccessDeniedException` messages, or SQL error codes. The exact text is part of the diagnosis.
- **Never disable a safety check to make an error go away** (e.g. setting `NODE_TLS_REJECT_UNAUTHORIZED=0`, silencing `helmet`, loosening CSP). Find the root cause.
- **Never silently chown `~/.npm` or `~/.aws`** to unblock an install. Ask the user first.

## Bedrock: `AccessDeniedException`

Three root causes, in order of likelihood:

1. **Model access not granted.** The IAM principal has `bedrock:InvokeModel`, but the account hasn't requested access to Claude Sonnet in the Bedrock console. Point the user at **AWS Console → Bedrock → Model access → Request model access** and tell them approval is usually instant.
2. **Missing `bedrock:InvokeModelWithResponseStream`.** `InvokeModel` alone is not enough — the template streams, so the streaming permission is mandatory.
3. **Wrong region.** `REGION` must be a Bedrock-enabled region (`us-east-1`, `us-west-2`, etc.). Matching the model's home region is safest.

## Bedrock: `security token invalid` (after previously working)

Symptom: chat worked yesterday, fails today with `The security token included in the request is invalid` or `ExpiredTokenException`.

Root cause: the MFA-session credentials that were exported into the server's shell have expired. They're typically 1–12h.

Fix:

```bash
eval "$(aws configure export-credentials --format env)"
# restart the server in the same shell
npm run dev
```

See [`../../devopser-setup/rules/llm-provider.md`](../../devopser-setup/rules/llm-provider.md) → **"MFA-protected IAM identity"** for the full flow. Do not write these keys into `.env`.

## `ECONNREFUSED` on port 5432

PostgreSQL is not reachable. Check in order:

1. Is the `sest-postgres` container running? `docker ps | grep sest-postgres`. If not, re-run `./scripts/setup.sh`.
2. Is the host DB running? `pg_isready` (if the user is on host-installed Postgres instead of the Docker path).
3. Does `.env`'s `POSTGRES_*` match what's actually running? Mismatched `POSTGRES_PORT` after a conflict override is a common culprit — see [`../../devopser-setup/rules/prerequisites.md`](../../devopser-setup/rules/prerequisites.md).

## Server exits on boot with a Redis error

Redis is required — the template **refuses to start** without it. Check:

1. `docker ps | grep sest-redis`.
2. `redis-cli -u "$REDIS_URL" ping` returns `PONG`.
3. `.env`'s `REDIS_URL` matches the actual host + port.

Do not edit the server to make Redis optional — it's load-bearing for session storage and conversation history.

## Port 8000 already in use

`EADDRINUSE` at boot. Before anything else:

```bash
lsof -iTCP:8000 -sTCP:LISTEN
```

If it's a prior `sest-app` container, stop it (`docker stop sest-app`) and retry. If it's something unrelated, tell the user which process owns it — don't silently set `PORT=8001`. Let them decide whether to move their app or the existing process.

## npm install fails with `EACCES` under `~/.npm/_cacache`

A previous `sudo npm install` somewhere left root-owned cache subdirs. Do **not** `sudo chown -R "$USER" ~/.npm` without asking. The quick fix that doesn't touch the user's global cache:

```bash
npm config set cache ~/.npm-user-cache
```

## Harmless warnings (don't chase these)

These appear on boot in normal local dev and are **not** errors:

| Log line | What it means |
|---|---|
| `[S3] ERROR: S3_BUCKET_NAME environment variable is required` | S3 is only used by the site-image upload feature. The rest of the app works. Set `S3_BUCKET_NAME=` to any value in `.env` to silence it. |
| `[OAuth] Google OAuth not configured` | Optional Google sign-in. Configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` only if the user wants Google sign-in. |
| `Missing credentials for PLAIN` / Gmail SMTP init failure | Email transport disabled (intentional if `MAIL_USERNAME`/`MAIL_PASSWORD` are blank). See [`../../devopser-setup/rules/email.md`](../../devopser-setup/rules/email.md). |

Do not "fix" these by silencing the log. Surface them to the user as benign.

## New route `302`s to `/auth/login`

The user added a new endpoint, got a `302` redirect, and is confused. Route-visibility is a two-edit problem: the handler **and** the `publicPaths` entry. See [`./public-routes.md`](./public-routes.md).

## Editing the chat system prompt "didn't do anything"

The user edited one chat surface expecting the other to change. See [`./chat-surfaces.md`](./chat-surfaces.md) — `/` and `/chat` don't share code. Confirm which file they touched and which URL they're testing.

## Verification gate

Before closing a troubleshooting thread:

- [ ] The root cause is named (not just "I tried some things and it worked now").
- [ ] The user has been told what the cause was, so the same failure mode is recognized next time.
- [ ] No safety check was disabled to make the error go away.
- [ ] If the fix was specific to a provider / environment / config, the skill or AGENTS.md is updated if the same failure would catch the next forker.

If any is false, the thread isn't closed.
