/**
 * OpenAI provider — talks to api.openai.com (or any OpenAI-compatible endpoint)
 * using the official `openai` SDK.
 *
 * Required env: OPENAI_API_KEY
 * Optional env: OPENAI_MODEL (default: gpt-4o-mini),
 *               OPENAI_BASE_URL (override for Azure OpenAI, local vLLM, etc.)
 */
const OpenAI = require('openai');
const config = require('../../config');

function create() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY to be set');
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const defaultSystemPrompt = config.chat.systemPrompt;
  const maxTokens = config.bedrock.maxTokens;
  const temperature = config.bedrock.temperature;

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
      const response = await client.chat.completions.create({
        model,
        messages: toOpenAI(messages),
        max_tokens: maxTokens,
        temperature,
      });
      return response.choices?.[0]?.message?.content || '';
    },

    async *streamResponse(messages) {
      const stream = await client.chat.completions.create({
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
