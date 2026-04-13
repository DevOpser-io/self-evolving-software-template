/**
 * LLM provider facade.
 *
 * Selects an implementation at startup based on LLM_PROVIDER and exposes a
 * normalized interface that the rest of the app can depend on regardless of
 * which backing model is in use:
 *
 *   generateResponse(messages)      -> Promise<string>
 *   streamResponse(messages)        -> AsyncIterable<string>   // yields text deltas
 *
 * Supported values for LLM_PROVIDER (case-insensitive):
 *   bedrock    (default) - AWS Bedrock (Claude via Amazon)
 *   openai               - OpenAI Chat Completions API
 *   anthropic            - Anthropic Claude API (direct, no AWS)
 *
 * To add another provider, create a new module that exports `create()`
 * returning { generateResponse, streamResponse } and wire it into the switch.
 */
const providerName = (process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

let impl;
switch (providerName) {
  case 'openai':
    impl = require('./openaiProvider').create();
    break;
  case 'anthropic':
    impl = require('./anthropicProvider').create();
    break;
  case 'bedrock':
    impl = require('./bedrockProvider').create();
    break;
  default:
    console.warn(`[llm] Unknown LLM_PROVIDER="${providerName}", falling back to bedrock`);
    impl = require('./bedrockProvider').create();
}

console.log(`[llm] Active provider: ${providerName}`);

module.exports = {
  provider: providerName,
  generateResponse: (messages, options) => impl.generateResponse(messages, options),
  streamResponse: (messages, options) => impl.streamResponse(messages, options),
};
