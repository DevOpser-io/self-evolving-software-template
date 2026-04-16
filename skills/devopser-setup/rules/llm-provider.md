# LLM provider selection

The chat UI does not work until one of three providers is configured. The server boots without credentials (providers are lazy-initialized), so "the process started" is not a valid definition of done. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"Ask the user for LLM credentials"** for the canonical prompt.

## Non-negotiables

- **Ask the user exactly once.** Never guess, never default silently.
- **Never write AWS keys to `.env` when using Bedrock.** They expire under MFA and go stale. Export them into the shell that runs the server instead.
- **Never invent an AWS profile name.** Read it from `~/.aws/config` or ask the user which one.

## The three-way fork

Ask the user verbatim:

> Which LLM provider do you want to use?
> - **OpenAI** — simplest, just needs `OPENAI_API_KEY` (https://platform.openai.com/api-keys)
> - **Anthropic (direct Claude API)** — needs `ANTHROPIC_API_KEY` (https://console.anthropic.com/settings/keys)
> - **AWS Bedrock** — needs AWS credentials with `bedrock:InvokeModel` in a Bedrock-enabled region (us-east-1, us-west-2, …)

### Branch A — OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_BASE_URL=          # set for Azure OpenAI / local vLLM
```

No pre-flight. Restart the server after editing `.env`.

### Branch B — Anthropic (direct)

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

No pre-flight. Restart the server after editing `.env`.

### Branch C — AWS Bedrock

Requires two things the other branches don't:

1. **Model access granted** in the AWS Console → Bedrock → Model access (approval is usually instant).
2. **Region must be Bedrock-enabled** — `us-east-1`, `us-west-2`, etc.

Write only the non-secret bits to `.env`:

```env
LLM_PROVIDER=bedrock
REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0
```

## MFA-protected IAM identity (Bedrock only — very common)

If the user's AWS identity has a `requireMFA`-style policy, their long-term keys will hit an explicit-deny even with `bedrock:InvokeModel` granted. The server needs **temporary MFA-session credentials** in its environment.

Export them into the shell that runs `npm run dev`:

```bash
eval "$(aws configure export-credentials --format env)"
# or, for a named profile:
eval "$(AWS_PROFILE=<their-profile> aws configure export-credentials --format env)"
```

Then start the server **in the same shell**:

```bash
npm run dev
```

These credentials expire (typically 1–12h). When the user reports "chat stopped working with `security token invalid`", the fix is to re-export and restart — not to edit `.env`.

**Known gotcha:** Node AWS SDK v3 cannot always read profiles defined in `~/.aws/config` as opposed to `~/.aws/credentials`. Prefer `aws configure export-credentials` over `AWS_PROFILE=...` on the server process.

## Starting the server

Ask the user which run mode, or default to `npm run dev` for fastest feedback:

```bash
npm run dev                                  # hot-reload, host-side
# or
docker compose --profile app up -d --build   # fully containerized
docker logs -f sest-app
```

Either puts the app on http://localhost:8000.

## Verification gate

Do **not** continue to [`verification.md`](./verification.md) until:

- `.env` has `LLM_PROVIDER=` set to one of `bedrock | openai | anthropic`.
- The matching API key is present, *or* for Bedrock, the shell that runs the server has `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` exported.
- The server process is running and not crash-looping.
