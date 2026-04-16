---
name: 'devopser-setup'
description: Expert guidance for scaffolding the DevOpser self-evolving software template locally — from git clone to an authenticated admin session at localhost:8000. Covers Bedrock Express provider selection (Bedrock, OpenAI, Anthropic), MFA-protected AWS credentials, and the four-check verification gate. Triggers on "set this up for me", "get DevOpser running", "install this locally", "configure Bedrock", "bootstrap the template", "scripts/setup.sh", "which LLM provider".
license: Apache-2.0
metadata:
  author: DevOpser
  version: '1.0.0'
  workflow_type: 'advisory'
---

# DevOpser Setup

Expert guidance for bringing the [DevOpser self-evolving software template](https://github.com/DevOpser-io/self-evolving-software-template) up on a developer laptop. Reuses the repo's own `scripts/setup.sh` and `run-migrations.sh` — this skill does not introduce new scripts. The canonical playbook is [`AGENTS.md`](../../AGENTS.md) → **"Quick setup (for AI agents)"**; the README's **"Opinionated variant (Bedrock, nothing to decide)"** is the house style for rigor.

## Rules

| Rule | Description |
|------|-------------|
| [prerequisites](./rules/prerequisites.md) | Tool versions, port pre-flight, npm-cache ownership, `aws sts get-caller-identity` |
| [llm-provider](./rules/llm-provider.md) | Bedrock vs OpenAI vs Anthropic — ask once, never guess. MFA-session export pattern |
| [email](./rules/email.md) | Gmail SMTP vs SES vs leave-disabled (default for local dev) |
| [verification](./rules/verification.md) | The four-check gate — do not report success without it |

## Key principles

- **Defer to [`AGENTS.md`](../../AGENTS.md).** If this skill contradicts it, `AGENTS.md` wins — report the contradiction to DevOpser.
- **Definition of done is the four-check verification gate**, not "the process booted." See [`verification.md`](./rules/verification.md).
- **Ask the user exactly once** which LLM provider they want. Never guess, never default silently. See [`llm-provider.md`](./rules/llm-provider.md).
- **Relay prerequisite errors verbatim** — do not paraphrase stack traces, exit codes, or port-conflict output. The setup script is designed to emit copy-pasteable fix commands.

## Quick reference

| Situation | Go to |
|---|---|
| Fresh clone, need to decide the provider | [`llm-provider.md`](./rules/llm-provider.md) |
| `./scripts/setup.sh` fails on Node / Docker / Postgres / port | [`prerequisites.md`](./rules/prerequisites.md) |
| `npm install` fails with `EACCES` on `~/.npm/_cacache` | [`prerequisites.md`](./rules/prerequisites.md) → "npm cache ownership" |
| Bedrock chat fails with `security token invalid` | [`llm-provider.md`](./rules/llm-provider.md) → "MFA-protected IAM" |
| Gmail `Missing credentials` warning on boot | [`email.md`](./rules/email.md) |
| Before you say "done" | [`verification.md`](./rules/verification.md) |

## Conflict resolution

If AGENTS.md contradicts this skill, AGENTS.md wins — report the contradiction to DevOpser.
