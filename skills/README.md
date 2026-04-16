# DevOpser Agent Skills

Agent skills for scaffolding, deploying, and customizing applications built on the [DevOpser self-evolving software template](https://github.com/DevOpser-io/self-evolving-software-template) — a full-stack SaaS starter (Express + Postgres + Redis + pluggable Bedrock/OpenAI/Anthropic chat + auth + admin + mobile shell).

These skills are **advisory**: they tell the agent *how* to think about the template's lifecycle, which scripts to run, and what "done" looks like. They defer to [`AGENTS.md`](../AGENTS.md) as the source of truth and do not wrap or replace any existing script.

Packaged in the [Agent Skills](https://agentskills.io/) format, so the same directory is consumed by Claude Code, Gemini CLI, Cursor, Copilot, Codex, OpenCode, and any other tool that speaks the convention.

## Installation

Pick the section that matches the agent you're running. All of them install the **same** three skills — `devopser-setup`, `devopser-deploy`, `devopser-customize` — by pointing at this repo.

### Universal (skills.sh CLI)

Works with any [Agent Skills](https://agentskills.io)-compatible tool:

```bash
npx skills add https://github.com/DevOpser-io/self-evolving-software-template --all
```

Or install a single skill:

```bash
npx skills add https://github.com/DevOpser-io/self-evolving-software-template --skill devopser-setup
```

### Claude Code

Run these two commands inside a Claude Code session:

```
/plugin marketplace add DevOpser-io/self-evolving-software-template
/plugin install devopser-agent-skills@DevOpser-io
```

The plugin is defined by [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) at the repo root; Claude Code auto-discovers the skills under `skills/` from there.

### Gemini CLI

```bash
gemini extensions install https://github.com/DevOpser-io/self-evolving-software-template
```

Update later with `gemini extensions update devopser-agent-skills`. The manifest is [`gemini-extension.json`](../gemini-extension.json).

### Cursor

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git \
  ~/.cursor/skills/devopser-agent-skills
```

Cursor auto-discovers skills from `.cursor/skills/` and `.agents/skills/`. The plugin manifest is [`.cursor-plugin/plugin.json`](../.cursor-plugin/plugin.json).

### Copilot

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git \
  ~/.copilot/skills/devopser-agent-skills
```

### OpenCode

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git \
  ~/.agents/skills/devopser-agent-skills
```

OpenCode auto-discovers from `.agents/skills/`, `.opencode/skills/`, and `.claude/skills/`.

### Codex (OpenAI)

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git \
  ~/.agents/skills/devopser-agent-skills
```

Update with `git -C ~/.agents/skills/devopser-agent-skills pull`.

### Manual / any other agent

The `skills/` directory is self-contained. Clone the repo and point your tool at `skills/`:

```bash
git clone https://github.com/DevOpser-io/self-evolving-software-template.git
ls self-evolving-software-template/skills
# devopser-customize  devopser-deploy  devopser-setup  README.md
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

## Verifying your install

After installing, ask the agent a trigger question (e.g. *"set this repo up for me locally"*). A successful install looks like:

- The agent cites `skills/devopser-setup/SKILL.md` or one of its rules (e.g. `rules/llm-provider.md`, `rules/verification.md`) by name.
- The agent asks the single LLM-provider question verbatim (Bedrock / OpenAI / Anthropic) rather than guessing.
- At the end of setup the agent runs the **four-check verification gate** from [`devopser-setup/rules/verification.md`](./devopser-setup/SKILL.md) before declaring "done".

If none of that shows up, the skill isn't loaded. Common causes: (a) the agent doesn't support Agent Skills, (b) the install path for your tool is different — check the tool's own docs for "skills" / "plugins" / "extensions".

## Keeping the skills honest

Run the validator from the repo root after any edit to `skills/`:

```bash
node scripts/validate-skills.js
```

It checks that every `SKILL.md` has valid frontmatter, every relative link resolves, every `path/to/file.ext:<line>`-style anchor points at a real file (e.g. `backend/server.js:411` must exist), and every backticked repo path exists. Exits nonzero on drift so it can be wired into CI.

## Relationship to AGENTS.md

[`AGENTS.md`](../AGENTS.md) is the canonical playbook. These skills point at its sections rather than duplicating them. If a skill and `AGENTS.md` disagree, `AGENTS.md` wins — and the agent should report the contradiction to DevOpser.

## License

Apache-2.0 — see [`../LICENSE`](../LICENSE).
