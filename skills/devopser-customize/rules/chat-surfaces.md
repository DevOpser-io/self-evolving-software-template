# The two chat surfaces

**The single most important rule in `devopser-customize`.** The template ships two chat UIs that look similar and are wired to completely different backends. Before editing either one, ask the user which they mean. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"The two chat surfaces (understand before editing)"** for the canonical breakdown.

## Non-negotiables

- **Ask the user exactly once:** *"Are you extending the landing / signup funnel (`/`) or the authenticated product chat (`/chat`)?"* Do not guess. Do not edit both.
- Do not copy code between the two surfaces "to share logic." They have different auth, different persistence, different contracts — the divergence is deliberate.
- Do not change the anonymous `/` surface to require auth without asking the user. It's the signup funnel — gating it breaks onboarding.

## The comparison

| | `/` (stateless preview) | `/chat` (stateful app) |
|---|---|---|
| **Route** | `backend/routes/index.js:13` | `backend/routes/chat.js:24` |
| **Template** | `backend/templates/landing-builder.ejs` | `backend/templates/chat.ejs` |
| **Frontend JS** | `backend/public/static/js/landing-builder.js` | — (server-rendered + `chat.ejs` scripts) |
| **Controller** | — (inline in the route handler) | `backend/controllers/chatController.js` |
| **Auth** | None — public, anonymous | `ensureFullAuth` — logged in; MFA-verified **only if** the user opted into MFA (it's off by default, OAuth logins skip it) |
| **Persistence** | None | Full thread history in Redis, keyed by `conversationId` |
| **Backend call** | `POST /api/preview/generate` (anonymous) | `POST /api/chat/message` → `POST/GET /api/chat/stream` (SSE) |
| **Shape** | Single-turn, one LLM call per prompt | Multi-turn; every request replays the whole thread |

## Decision question (mandatory)

Before writing or changing anything chat-adjacent, ask:

> Are you extending **the landing / signup funnel** (the anonymous preview chat at `/`, the one that converts visitors into signups) or **the authenticated product chat** (the full multi-turn app at `/chat` that logged-in, MFA-verified users actually use)?

Then proceed to the matching column below.

### Branch A — editing `/` (landing / preview)

Edit:

- `backend/routes/index.js` — for the route and the server-rendered portion.
- `backend/templates/landing-builder.ejs` — for the visible UI.
- `backend/public/static/js/landing-builder.js` — for the client-side chat behavior.
- The `POST /api/preview/generate` handler — for the LLM call shape.

Cheap: no DB schema changes, no auth concerns, no Redis bookkeeping. Anonymous traffic is supposed to be cheap here.

### Branch B — editing `/chat` (the real product)

Edit:

- `backend/templates/chat.ejs` — for the UI shell.
- `backend/controllers/chatController.js` — for system prompt, tool calls, response shaping.
- `backend/routes/chat.js` — only if you're adding new endpoints or changing auth gates.
- `backend/services/redisService.js` — only if you're changing conversation-storage semantics (usually you shouldn't).

This is where you plug in per-user tools, RAG, function calling, custom system prompts, conversation branching. The streaming pipeline and conversation storage already work; don't rebuild them.

### Branch C — non-chat product (deleting both)

If the user is building a SaaS that isn't chat-centric (CRM, project tracker, analytics dashboard), both surfaces can be deleted outright along with `backend/services/llm/`. The auth, admin, email, Postgres, Redis, mobile-shell, and session infrastructure all stand on their own.

## The common mistake

Editing `landing-builder.js` thinking you're improving the main chat app. You aren't — `/` and `/chat` don't share code. If the user reports "I changed the system prompt and nothing happened," check which file they touched.

## Verification gate

Before reporting a chat-surface customization complete:

- [ ] Only the intended surface's files were modified. `git diff` shows no changes to the other surface.
- [ ] The intended surface behaves correctly in a browser (not just in tests): `/` renders without a login redirect for anonymous users; `/chat` streams new turns and appears in `/conversation_history` for logged-in users (plus an MFA prompt if they've opted into MFA).
- [ ] If the other surface was supposed to keep working, its smoke test (visit it, type a prompt, get a response) still passes.

If any is false, do not report success.
