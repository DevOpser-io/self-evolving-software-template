/**
 * Anthropic provider — talks to api.anthropic.com directly using the official
 * `@anthropic-ai/sdk`, bypassing AWS Bedrock. Useful if you have an Anthropic
 * API key but no AWS setup.
 *
 * Required env: ANTHROPIC_API_KEY
 * Optional env: ANTHROPIC_MODEL (default: claude-sonnet-4-5-20250929)
 *
 * The Anthropic client is constructed lazily on the first chat request so the
 * server can boot with an unconfigured key (e.g. right after `./scripts/setup.sh`
 * but before the user has filled in `.env`). The friendly error surfaces on
 * first use instead of at module load.
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');

function create() {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  const defaultSystemPrompt = config.chat.systemPrompt;
  const maxTokens = config.bedrock.maxTokens;
  const temperature = config.bedrock.temperature;

  let cachedClient = null;
  function getClient() {
    if (cachedClient) return cachedClient;
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY to be set in .env. ' +
        'Get a key at https://console.anthropic.com/settings/keys and restart the server.'
      );
    }
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return cachedClient;
  }

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
      const response = await getClient().messages.create({
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
      const stream = await getClient().messages.create({
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
