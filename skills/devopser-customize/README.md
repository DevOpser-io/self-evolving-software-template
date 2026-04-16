# devopser-customize

Human-facing overview. The agent-facing file is [`SKILL.md`](./SKILL.md).

## What this skill does

Guides an AI coding agent through reshaping the DevOpser self-evolving software template into an actual product — the work that consumes most of a fork's life. Covers the two chat surfaces, route visibility, adding a fourth LLM provider, productization patterns from DevOpser's own product family, and the expanded troubleshooting matrix.

No new scripts are introduced. Advisory only.

## Example user queries that trigger it

- "Change the chat system prompt to be a support agent."
- "Add a `/pricing` page that anonymous visitors can see."
- "Add Mistral as a fourth LLM provider alongside Bedrock, OpenAI, and Anthropic."
- "I want to build something like Fairytale Genie on top of this template."
- "My new endpoint `/api/export` keeps redirecting to `/auth/login` — what's wrong?"

## Rules

| Rule | Description |
|------|-------------|
| [chat-surfaces](./rules/chat-surfaces.md) | `/` stateless preview vs `/chat` stateful multi-turn — the decision question |
| [public-routes](./rules/public-routes.md) | `publicPaths` at `backend/server.js:411` is the single source of truth |
| [llm-providers](./rules/llm-providers.md) | Adding a fourth provider; the Converse-API caveat |
| [productize](./rules/productize.md) | Lite / Fairytale Genie / Language Bazaar / Stores patterns |
| [troubleshooting](./rules/troubleshooting.md) | Bedrock access, MFA expiry, harmless warnings, route redirects |

## See also

- Top-level index: [`../README.md`](../README.md)
- Canonical playbook: [`../../AGENTS.md`](../../AGENTS.md) → "Core extension points" and "The two chat surfaces"
