/**
 * OpenAI provider — talks to api.openai.com (or any OpenAI-compatible endpoint)
 * using the official `openai` SDK.
 *
 * Required env: OPENAI_API_KEY
 * Optional env: OPENAI_MODEL (default: gpt-4o-mini),
 *               OPENAI_BASE_URL (override for Azure OpenAI, local vLLM, etc.)
 *
 * The OpenAI client is constructed lazily on the first chat request so the
 * server can boot with an unconfigured key (e.g. right after `./scripts/setup.sh`
 * but before the user has filled in `.env`). The friendly error surfaces on
 * first use instead of at module load.
 */
const OpenAI = require('openai');
const config = require('../../config');

function create() {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const defaultSystemPrompt = config.chat.systemPrompt;
  const maxTokens = config.bedrock.maxTokens;
  const temperature = config.bedrock.temperature;

  let cachedClient = null;
  function getClient() {
    if (cachedClient) return cachedClient;
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'LLM_PROVIDER=openai requires OPENAI_API_KEY to be set in .env. ' +
        'Get a key at https://platform.openai.com/api-keys and restart the server.'
      );
    }
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    return cachedClient;
  }

  function toOpenAI(messages) {
    const hasSystem = messages.some((m) => m.role === 'system');
    const normalized = (hasSystem ? messages : [{ role: 'system', content: defaultSystemPrompt }, ...messages])
      .filter((m) => m && m.content)
      .map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));

    if (normalized.filter((m) => m.role !== 'system').length === 0) {
      normalized.push({ role: 'user', content: 'Hello' });
    }
    return normalized;
  }

  return {
    async generateResponse(messages) {
      const response = await getClient().chat.completions.create({
        model,
        messages: toOpenAI(messages),
        max_tokens: maxTokens,
        temperature,
      });
      return response.choices?.[0]?.message?.content || '';
    },

    async *streamResponse(messages) {
      const stream = await getClient().chat.completions.create({
        model,
        messages: toOpenAI(messages),
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

module.exports = { create };
