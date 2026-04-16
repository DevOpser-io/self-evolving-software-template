# Productize — patterns from the DevOpser product family

The template is a starter, not a product. DevOpser's own product line — **DevOpser Lite**, **Fairytale Genie**, **Language Bazaar**, **Stores** — are all forks of this template with specific pieces kept, swapped, or deleted. This rule catalogues the patterns so an AI agent can reason about a fork by analogy instead of from first principles.

## Non-negotiables

- Ask the user what they're building before suggesting one of the patterns below. The decision of "which subsystems to keep / swap / delete" is the user's, not the agent's.
- Delete code boldly but commit cleanly. If you remove the website builder, also remove its routes from `publicPaths` (see [`./public-routes.md`](./public-routes.md)) and its migrations from the `Site` model path — don't leave dangling references.
- Keep the portability rule (`NODE_ENV=production` → Secrets Manager, `development` → env vars) even as you reshape the product. See [`../../devopser-deploy/rules/secrets-manager.md`](../../devopser-deploy/rules/secrets-manager.md).

## The four patterns

### 1. DevOpser Lite — "specialize the vertical"

**What it is:** a landing-page builder. Kept the website-builder scaffolding and specialized it for a single vertical.

**What to keep:** the `/` preview chat, the `Site` model, `websiteAgentService.js`, the template-backed builder UI.

**What to swap:** the system prompt, the template catalogue, the landing-page copy. The `Publish` button wires into whatever deploy target you pick in [`../../devopser-deploy/SKILL.md`](../../devopser-deploy/SKILL.md).

**What to delete:** nothing substantial — Lite is the template's "closest relative."

**When to suggest this pattern:** the user wants a site/page generator for a specific audience (e.g. consultants, restaurants, real estate, portfolios).

### 2. Fairytale Genie — "swap the creative core"

**What it is:** an AI story + image generator. Replaced the website builder entirely with a Bedrock Nova Canvas image-generation pipeline and server-side story parsing.

**What to keep:** auth, admin, `/chat` surface (repurposed as the story chat), Redis conversation storage, email transport, mobile shell, Secrets Manager pattern.

**What to swap:** `websiteAgentService.js` → an image-and-story service. `chat.ejs` → the story-page UI. `chatController.js` → hands structured output (story + image prompts) to the client.

**What to delete:** `backend/services/templateService.js`, the `Site` model + routes, the builder UI, `/api/preview/generate`.

**When to suggest this pattern:** the user is building a generative-media product where the "conversation" yields a multi-part artifact (story + image, recipe + photo, outfit + render).

### 3. Language Bazaar — "add a realtime modality"

**What it is:** a realtime language tutor using OpenAI Realtime Voice.

**What to keep:** everything in the template — auth, admin, two chat surfaces, Redis, mobile.

**What to swap:** add a new provider file (see [`./llm-providers.md`](./llm-providers.md)) that talks to OpenAI Realtime Voice. The `/chat` surface gains a websocket/RTC path alongside the existing SSE path.

**What to delete:** nothing, unless the builder UI is off-topic for the product.

**When to suggest this pattern:** the user needs realtime audio / video / low-latency streaming alongside the template's SSE chat.

### 4. Stores — "multi-tenant verticalization"

**What it is:** a multi-tenant e-commerce product.

**What to keep:** auth, admin, email, mobile, Secrets Manager, the cross-account AssumeRole pattern from [`../../devopser-deploy/rules/cross-account.md`](../../devopser-deploy/rules/cross-account.md).

**What to swap:** the `Site` model becomes a `Store` model with products, orders, and tenants. The builder UI becomes a storefront editor.

**What to delete:** the LLM-facing `/` preview if the product's onboarding doesn't need it. Keep `/chat` only if you're wiring in a shopping assistant.

**When to suggest this pattern:** the user is building a per-customer product surface that needs tenant isolation — e-commerce, per-firm portals, white-labeled apps.

## How to walk a user through a productization

1. Ask what they're building in one sentence.
2. Map it to the closest pattern above.
3. Name the subsystems to **keep**, **swap**, **delete** — and be explicit about the delete list, since that's where forkers hesitate.
4. Walk the decision through [`./chat-surfaces.md`](./chat-surfaces.md) (which chat surface do they mean?) and [`./public-routes.md`](./public-routes.md) (what's the new public surface?).
5. Only *after* the plan is agreed, start editing.

## Verification gate

Before reporting a productization complete:

- [ ] The delete list is actually deleted — no dangling routes, no unused models, no orphan migrations.
- [ ] `publicPaths` in `backend/server.js` matches the new public surface (no stale `/sites/*`-style entries if the builder is gone).
- [ ] The `NODE_ENV` portability rule still holds: same code path runs self-hosted and on managed hosting.
- [ ] Smoke tests for the kept surfaces still pass (login, admin panel, at least one chat turn).

If any is false, do not report success.
