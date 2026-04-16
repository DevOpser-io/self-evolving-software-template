# Adding a new LLM provider

The template ships with three providers behind a facade in `backend/services/llm/`: `bedrock`, `openai`, `anthropic`. Adding a fourth (Mistral, Cohere, local vLLM, Together.ai, Groq, DeepSeek, …) is a deliberately small change — most of the code never learns the new provider exists. See [`../../../AGENTS.md`](../../../AGENTS.md) → **"LLM provider — `backend/services/llm/`"** for the canonical extension contract.

## Non-negotiables

- **Don't touch `chatController.js` or `websiteAgentService.js`.** They consume the normalized facade. If they need to change, you've done something wrong.
- **Don't leak provider-specific chunk shapes into the facade.** `streamResponse` must yield **plain text deltas** — strings only. Normalize any SSE / JSON-chunk / event-stream format inside your provider file.
- **`websiteAgentServiceV2.js` is Bedrock-only by design.** It uses the Bedrock Converse API directly for tool calling. Don't try to refactor it to use your new provider — leave it behind the `LLM_PROVIDER=bedrock` gate and route non-Bedrock users to `websiteAgentService.js` (the v1, facade-based path).

## The contract

Your provider file exports a `create()` function that returns an object with exactly two methods:

```js
// backend/services/llm/myProvider.js
module.exports = {
  create({ /* any provider-specific config you read from env */ }) {
    return {
      async generateResponse(messages) {
        // messages: [{ role: 'user' | 'assistant' | 'system', content: string }]
        // returns: full response string (non-streaming)
      },

      async *streamResponse(messages) {
        // yields: plain string deltas, one per chunk, in order.
        // Do NOT yield provider-specific chunk objects. Normalize here.
      },
    };
  },
};
```

## The four edits

Start from the simplest reference: [`backend/services/llm/openaiProvider.js`](../../../backend/services/llm/openaiProvider.js).

**1. Copy it:**

```bash
cp backend/services/llm/openaiProvider.js backend/services/llm/myProvider.js
```

**2. Implement `generateResponse` and `streamResponse`.** Keep them pure — no session state, no cross-call caching. If the provider's streaming API yields structured chunks (JSON events, function-call deltas, tool-use blocks), unwrap them to text inside your provider. The consumer expects strings.

**3. Register the new name in `backend/services/llm/index.js`:**

```js
case 'mistral':
  return require('./mistralProvider').create({ /* read MISTRAL_API_KEY, MISTRAL_MODEL from env */ });
```

**4. Document the env vars.** Add a block to `.env.example` and to [`../../../README.md`](../../../README.md) step 4. Mirror the shape of the existing OpenAI / Anthropic blocks.

## The Converse API caveat

`backend/services/websiteAgentServiceV2.js` is the tool-calling website builder. It uses **Bedrock's Converse API directly** for tool-use fidelity and is explicitly Bedrock-only. Today it is the **only** path wired into `backend/routes/sites.js` and `backend/routes/preview.js` — both files import directly from V2 with no branching on `LLM_PROVIDER`.

What this means in practice:

- The chat-message paths (`/api/chat/message`, `/api/chat/stream`, `/` preview turn-taking after the builder is gone) flow through the `backend/services/llm/` facade and work on any provider you register.
- The **website-builder** paths (the `/` preview's site generation and `/sites/*` edit-with-chat) currently require `LLM_PROVIDER=bedrock`. A non-Bedrock user who hits `POST /api/preview/generate` or the builder chat will get a runtime failure from V2, not a graceful fallback.
- `backend/services/websiteAgentService.js` (v1) is facade-based and provider-agnostic, but **nothing imports it** in the current commit. If you want OpenAI / Anthropic / your new provider to drive the builder, you must swap the two imports manually:

  ```js
  // backend/routes/sites.js   — change:
  const { processWithTools, generateSiteFromDescription } = require('../services/websiteAgentServiceV2');
  // to (for non-Bedrock):
  const { generateSiteFromDescription } = require('../services/websiteAgentService');
  // and drop processWithTools calls — v1 has no tool-use equivalent.

  // backend/routes/preview.js — same swap on its single import.
  ```

- Don't try to port V2 to OpenAI / Anthropic / your new provider by hand — the tool-use protocols differ enough that a faithful port is its own project. If the user wants tool calling on their provider, talk about it first.

## Testing the new provider

Set the env:

```env
LLM_PROVIDER=mistral
MISTRAL_API_KEY=...
MISTRAL_MODEL=...
```

Restart `npm run dev`. Smoke checks:

1. `/chat` (after login): send three turns, confirm each turn replays the full thread (you should see the model reference earlier turns). This path uses the facade and is the core smoke test for a new provider.
2. The server log should not contain any `[LLM]` or `[Chat]` warnings about missing provider registration.
3. The `/` landing page's **website-builder** chat will still try to call Bedrock's Converse API (see "Converse API caveat" above) — a non-Bedrock provider can't drive the builder without swapping `routes/sites.js` and `routes/preview.js` to the v1 service. If the user isn't building a builder product, this is fine to ignore; if they are, surface it honestly before reporting "done".

## Verification gate

Before reporting the fourth provider wired up:

- [ ] A single new file `backend/services/llm/<name>Provider.js` exists and implements both methods.
- [ ] `backend/services/llm/index.js` registers the new name in its switch.
- [ ] `.env.example` and `README.md` step 4 document the env vars.
- [ ] `chatController.js` is unchanged (`git diff` is clean). `websiteAgentService.js` is unchanged **unless** the user explicitly asked you to re-wire the builder paths away from V2.
- [ ] Smoke checks 1 and 2 above pass.
- [ ] If the user wants the builder UI to work on their non-Bedrock provider, you've either manually swapped `routes/sites.js` + `routes/preview.js` to `websiteAgentService.js` with their agreement, **or** you've told them plainly that the builder is Bedrock-only today and let them decide.

If any is false, do not report success.
