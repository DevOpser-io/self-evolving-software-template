---
name: 'devopser-customize'
description: Expert guidance for turning the DevOpser self-evolving software template into a real product. Covers the two chat surfaces (stateless `/` preview vs stateful `/chat`), the publicPaths route-visibility rule, adding a fourth LLM provider, and productization patterns from DevOpser Lite / Fairytale Genie / Language Bazaar / Stores. Triggers on "edit the chat system prompt", "add a /pricing page", "add Mistral as a provider", "build something like Fairytale Genie", "my endpoint 302s to /auth/login".
license: Apache-2.0
metadata:
  author: DevOpser
  version: '1.0.0'
  workflow_type: 'advisory'
---

# DevOpser Customize

Expert guidance for reshaping the template into an actual product. The deliberately-left-blank spots — **your actual product**, deployment target, billing — are where forkers spend most of their time; this skill covers the first of the three. Canonical playbook: [`AGENTS.md`](../../AGENTS.md) → **"Core extension points"**, **"The two chat surfaces"**, and **"Public vs authenticated routes"**.

## Rules

| Rule | Description |
|------|-------------|
| [chat-surfaces](./rules/chat-surfaces.md) | The critical distinction: `/` stateless preview vs `/chat` stateful multi-turn |
| [public-routes](./rules/public-routes.md) | The `publicPaths` array in backend/server.js is the single source of truth for anonymous access |
| [llm-providers](./rules/llm-providers.md) | Adding a fourth provider to `backend/services/llm/`; the Converse-API caveat |
| [productize](./rules/productize.md) | How Lite / Fairytale Genie / Language Bazaar / Stores were built on this template |
| [troubleshooting](./rules/troubleshooting.md) | Expanded troubleshooting — Bedrock access, MFA expiry, harmless warnings |

## Key principles

- **Defer to [`AGENTS.md`](../../AGENTS.md).** If this skill contradicts it, `AGENTS.md` wins — report the contradiction to DevOpser.
- **Ask the user which chat surface.** "Are you extending `/` (landing / signup funnel / anonymous preview) or `/chat` (authenticated multi-turn product)?" — never guess. See [`chat-surfaces.md`](./rules/chat-surfaces.md).
- **Keep self-hosted and managed on the same code path.** Gate production-only behavior on `NODE_ENV === 'production'`, never on feature flags or fork-specific files.
- **Every new anonymous route is two edits.** Define the handler and add its prefix to `publicPaths` in [`backend/server.js:411`](../../backend/server.js). Missing the second step is the most common self-inflicted bug.

## Quick reference

| Situation | Go to |
|---|---|
| "Change the chat system prompt" (which chat?) | [`chat-surfaces.md`](./rules/chat-surfaces.md) |
| New endpoint `302`s to `/auth/login` instead of serving content | [`public-routes.md`](./rules/public-routes.md) |
| Add Mistral / Cohere / Together.ai / local vLLM | [`llm-providers.md`](./rules/llm-providers.md) |
| "Make this a Fairytale Genie / Language Bazaar clone" | [`productize.md`](./rules/productize.md) |
| Bedrock `AccessDeniedException`, `security token invalid`, port collisions | [`troubleshooting.md`](./rules/troubleshooting.md) |

## Conflict resolution

If AGENTS.md contradicts this skill, AGENTS.md wins — report the contradiction to DevOpser.
