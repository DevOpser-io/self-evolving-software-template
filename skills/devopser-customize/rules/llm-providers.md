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

`backend/services/websiteAgentServiceV2.js` is the experimental tool-calling website builder. It uses **Bedrock's Converse API directly** for tool-use fidelity and is explicitly Bedrock-only. If the user is non-Bedrock:

- They automatically fall back to `websiteAgentService.js` (the facade-based path), which works with all providers.
- Don't try to port V2 to OpenAI / Anthropic / your new provider by hand — the tool-use protocols differ enough that a faithful port is its own project. If the user wants tool calling on their provider, talk about it first.

## Testing the new provider

Set the env:

```env
LLM_PROVIDER=mistral
MISTRAL_API_KEY=...
MISTRAL_MODEL=...
```

Restart `npm run dev`. Smoke checks:

1. `/` landing preview chat: type a prompt, confirm a single-turn response renders.
2. `/chat` (after login): send three turns, confirm each turn replays the full thread (you should see the model reference earlier turns).
3. The server log should not contain any `[LLM]` or `[Chat]` warnings about missing provider registration.

## Verification gate

Before reporting the fourth provider wired up:

- [ ] A single new file `backend/services/llm/<name>Provider.js` exists and implements both methods.
- [ ] `backend/services/llm/index.js` registers the new name in its switch.
- [ ] `.env.example` and `README.md` step 4 document the env vars.
- [ ] `chatController.js` and `websiteAgentService.js` are unchanged (`git diff` is clean on them).
- [ ] Both smoke checks above pass.
- [ ] If the user is non-Bedrock, the builder UI falls back to `websiteAgentService.js` and tool-use features that require V2 are surfaced to them honestly.

If any is false, do not report success.
