# devopser-setup

Human-facing overview. The agent-facing file is [`SKILL.md`](./SKILL.md).

## What this skill does

Walks an AI coding agent from a fresh clone of the DevOpser self-evolving software template to a verified local dev loop — an authenticated admin session at http://localhost:8000 with a working chat UI backed by Bedrock, OpenAI, or Anthropic.

It doesn't add new scripts. It tells the agent *how to use* `./scripts/setup.sh`, what to ask the user, and how to verify the result.

## Example user queries that trigger it

- "Set this repo up for me locally."
- "Get the DevOpser template running at localhost:8000."
- "Configure Bedrock with my MFA-protected AWS profile and start the app."
- "I ran `./scripts/setup.sh` and got a port conflict — help."
- "The chat UI says `security token invalid` after I came back from lunch."

## Rules

| Rule | Description |
|------|-------------|
| [prerequisites](./rules/prerequisites.md) | Node / Docker / port / npm-cache / AWS CLI pre-flight |
| [llm-provider](./rules/llm-provider.md) | Bedrock vs OpenAI vs Anthropic — the single credentials question |
| [email](./rules/email.md) | Gmail SMTP vs SES vs leave-disabled |
| [verification](./rules/verification.md) | The four-check gate that defines "done" |

## See also

- Top-level index: [`../README.md`](../README.md)
- Canonical playbook: [`../../AGENTS.md`](../../AGENTS.md)
- Human quick-start: [`../../README.md`](../../README.md)
