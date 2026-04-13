/**
 * Anthropic provider — talks to api.anthropic.com directly using the official
 * `@anthropic-ai/sdk`, bypassing AWS Bedrock. Useful if you have an Anthropic
 * API key but no AWS setup.
 *
 * Required env: ANTHROPIC_API_KEY
 * Optional env: ANTHROPIC_MODEL (default: claude-sonnet-4-5-20250929)
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');

function create() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  const defaultSystemPrompt = config.chat.systemPrompt;
  const maxTokens = config.bedrock.maxTokens;
  const temperature = config.bedrock.temperature;

  function toAnthropic(messages) {
    let system = defaultSystemPrompt;
    const normalized = [];
    for (const m of messages.filter((msg) => msg && msg.content)) {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      if (m.role === 'system') {
        system = content;
      } else if (m.role === 'user' || m.role === 'assistant') {
        normalized.push({ role: m.role, content });
      } else {
        normalized.push({ role: 'user', content });
      }
    }
    if (normalized.length === 0) {
      normalized.push({ role: 'user', content: 'Hello' });
    }
    return { system, messages: normalized };
  }

  return {
    async generateResponse(messages) {
      const { system, messages: msgs } = toAnthropic(messages);
      const response = await client.messages.create({
        model,
        system,
        messages: msgs,
        max_tokens: maxTokens,
        temperature,
      });
      const block = response.content?.find?.((c) => c.type === 'text');
      return block?.text || '';
    },

    async *streamResponse(messages) {
      const { system, messages: msgs } = toAnthropic(messages);
      const stream = await client.messages.create({
        model,
        system,
        messages: msgs,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta && event.delta.text) {
          yield event.delta.text;
        }
      }
    },
  };
}

module.exports = { create };
