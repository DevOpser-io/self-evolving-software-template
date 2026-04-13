/**
 * Bedrock provider — wraps the existing bedrockService so the LLM facade can
 * hand back a normalized async iterable of text deltas regardless of which
 * underlying SDK is in use.
 *
 * This reuses the singleton BedrockClient (which handles STS / cross-account
 * role / credential refresh) so there's no duplicated AWS auth logic.
 */
const { bedrockClientInstance, generateResponse } = require('../bedrockService');

function create() {
  return {
    async generateResponse(messages) {
      return generateResponse(messages);
    },

    async *streamResponse(messages) {
      const response = await bedrockClientInstance.createChatCompletion(messages, true);
      for await (const event of response.body) {
        if (!event.chunk || !event.chunk.bytes) continue;
        let data;
        try {
          data = JSON.parse(Buffer.from(event.chunk.bytes).toString('utf-8'));
        } catch (err) {
          console.error('[bedrock] failed to parse stream chunk:', err.message);
          continue;
        }

        if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
          yield data.delta.text;
        } else if (
          data.type === 'content_block_start' &&
          data.content_block &&
          data.content_block.type === 'text' &&
          data.content_block.text
        ) {
          yield data.content_block.text;
        }
      }
    },
  };
}

module.exports = { create };
