# DevOpser Agent Skills

Agent skills for scaffolding, deploying, and customizing applications built on the [DevOpser self-evolving software template](https://github.com/DevOpser-io/self-evolving-software-template) — a full-stack SaaS starter (Express + Postgres + Redis + pluggable Bedrock/OpenAI/Anthropic chat + auth + admin + mobile shell).

These skills are **advisory**: they tell the agent *how* to think about the template's lifecycle, which scripts to run, and what "done" looks like. They defer to [`AGENTS.md`](../AGENTS.md) as the source of truth and do not wrap or replace any existing script.

## Installation

Agentskills-compatible installer (Claude Code, Cursor, Aider, Copilot Workspace, any `skills`-compatible agent):

```bash
npx skills add https://github.com/DevOpser-io/self-evolving-software-template --all
```

Or a single skill:

```bash
npx skills add https://github.com/DevOpser-io/self-evolving-software-template --skill devopser-setup
```

## Available skills

| Skill | Use when… |
|---|---|
| [devopser-setup](./devopser-setup/SKILL.md) | The human wants the template *running locally* — from `git clone` to `http://localhost:8000` with an authenticated admin session. Covers Bedrock / OpenAI / Anthropic selection, MFA-protected AWS credentials, the four-check verification gate. |
| [devopser-deploy](./devopser-deploy/SKILL.md) | The human wants to ship the template to a real environment — Lightsail, Cloud Run, Fly.io, ECS Fargate, Kubernetes, a VPS — or build Android/iOS release artifacts. Covers target selection, AWS Secrets Manager in prod, the cross-account AssumeRole pattern, keystore signing. |
| [devopser-customize](./devopser-customize/SKILL.md) | The human wants to turn the template into their actual product — extending the `/` preview chat vs the `/chat` stateful app, adding public routes, wiring a fourth LLM provider, modeling after Lite / Fairytale Genie / Language Bazaar / Stores. |

## When each skill activates

- **"Set this up for me", "get it running", "install this locally", "configure Bedrock"** → `devopser-setup`.
- **"Deploy this to Lightsail / Cloud Run / Fargate / Kubernetes", "build the Android APK", "sign the iOS release", "wire up cross-account deploys"** → `devopser-deploy`.
- **"Make this a CRM / support desk / image generator", "add Mistral as a provider", "add a public `/pricing` page", "productize this like Fairytale Genie"** → `devopser-customize`.

## Relationship to AGENTS.md

[`AGENTS.md`](../AGENTS.md) is the canonical playbook. These skills point at its sections rather than duplicating them. If a skill and `AGENTS.md` disagree, `AGENTS.md` wins — and the agent should report the contradiction to DevOpser.

## License

Apache-2.0 — see [`../LICENSE`](../LICENSE).
