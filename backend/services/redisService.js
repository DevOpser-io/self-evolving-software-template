/**
 * Redis Service
 * Functions for chat history storage using Redis
 * Follows the exact same pattern as the Flask template
 */
const config = require('../config');
const redisClient = require('./redisClient');
const CHAT_HISTORY_TTL = config.cache.ttl || 3600;  // Use configured TTL or default to 1 hour

/**
 * Get chat history from Redis
 * @param {string} conversationId - The conversation ID
 * @returns {Array} - The chat history, or empty array if not found
 */
async function getChatHistory(conversationId) {
  try {
    if (!conversationId) {
      console.error('[CHAT_HISTORY] Missing conversation ID');
      return [];
    }
    
    const redis_client = redisClient.getClient();
    if (!redis_client) {
      console.error('[CHAT_HISTORY] Redis client not initialized');
      return [];
    }
    
    const cache_version = config.cache.version;
    const redis_key = `chat:${cache_version}:${conversationId}`;
    
    console.log(`[CHAT_HISTORY] Attempting to get chat history for conversation ${conversationId}`);
    console.log(`[CHAT_HISTORY] Using Redis key: ${redis_key}`);
    
    const chat_history_json = await redis_client.get(redis_key);
    
    if (chat_history_json) {
      const history = JSON.parse(chat_history_json);
      console.log(`[CHAT_HISTORY] Successfully loaded history for ${conversationId}, length: ${history.length}`);
      console.log(`[CHAT_HISTORY] Full history content: ${JSON.stringify(history, null, 2)}`);
      return history;
    } else {
      console.log(`[CHAT_HISTORY] No existing history found for conversation ${conversationId}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[CHAT_HISTORY] JSON decode error for ${conversationId}: ${error.message}`);
    } else if (error.name === 'RedisError') {
      console.error(`[CHAT_HISTORY] Redis error for ${conversationId}: ${error.message}`);
    } else {
      console.error(`[CHAT_HISTORY] Unexpected error for ${conversationId}: ${error.message}`);
    }
  }
  
  // Return empty list by default
  console.log(`[CHAT_HISTORY] Returning empty history for conversation ${conversationId}`);
  return [];
}

/**
 * Save chat history to Redis
 * @param {string} conversationId - The conversation ID
 * @param {Array} chatHistory - The chat history to save
 */
async function saveChatHistory(conversationId, chatHistory) {
  try {
    if (!conversationId) {
      console.error('[CHAT_HISTORY] Missing conversation ID when saving');
      return false;
    }
    
    if (!Array.isArray(chatHistory)) {
      console.error(`[CHAT_HISTORY] Invalid chat history format: ${typeof chatHistory}`);
      return false;
    }
    
    const redis_client = redisClient.getClient();
    if (!redis_client) {
      console.error('[CHAT_HISTORY] Redis client not initialized when saving');
      return false;
    }
    
    const cache_version = config.cache.version;
    const redis_key = `chat:${cache_version}:${conversationId}`;
    
    const chat_history_json = JSON.stringify(chatHistory);
    
    await redis_client.setEx(
      redis_key, 
      CHAT_HISTORY_TTL, 
      chat_history_json
    );
    console.log(`Successfully saved chat history to Redis for conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error(`Error saving chat history to Redis: ${error.message}`);
    return false;
  }
}

/**
 * Delete chat history from Redis
 * @param {string} conversationId - The conversation ID
 */
async function deleteChatHistory(conversationId) {
  try {
    if (!conversationId) {
      console.error('[CHAT_HISTORY] Missing conversation ID when deleting');
      return false;
    }
    
    const redis_client = redisClient.getClient();
    if (!redis_client) {
      console.error('[CHAT_HISTORY] Redis client not initialized when deleting');
      return false;
    }
    
    const cache_version = config.cache.version;
    const key = `chat:${cache_version}:${conversationId}`;
    
    await redis_client.del(key);
    console.log(`Successfully deleted chat history for conversation ${conversationId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting chat history from Redis: ${error.message}`);
    return false;
  }
}

/**
 * Clear old cache on startup
 * This matches the Flask implementation that clears old cache entries
 */
async function clearOldCache() {
  const redis_client = redisClient.getClient();
  if (!redis_client) {
    console.error('Redis client not initialized when clearing old cache');
    return false;
  }
  
  const current_version = config.cache.version;
  
  try {
    // Get all keys with the pattern chat:*
    const chatKeys = await scanKeys(redis_client, 'chat:*');
    
    // Delete keys that don't match current version
    for (const key of chatKeys) {
      if (!key.startsWith(`chat:${current_version}:`)) {
        await redis_client.del(key);
      }
    }
    
    // Get all keys with the pattern session:*
    const sessionKeys = await scanKeys(redis_client, 'session:*');
    
    // Delete keys that don't match current version
    for (const key of sessionKeys) {
      if (!key.startsWith(`session:${current_version}:`)) {
        await redis_client.del(key);
      }
    }
    
    console.log(`Old cache cleared for version ${current_version}`);
    return true;
  } catch (error) {
    console.error(`Redis error when clearing old cache: ${error.message}`);
    return false;
  }
}

/**
 * Helper function to scan for keys with a pattern
 * @param {Object} client - Redis client
 * @param {string} pattern - Key pattern to search for
 * @returns {Array} - List of matching keys
 */
async function scanKeys(client, pattern) {
  try {
    let cursor = 0;
    const keys = [];
    
    do {
      // Use SCAN to get keys in batches to avoid blocking Redis
      const result = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = result.cursor;
      if (result.keys) {
        keys.push(...result.keys);
      }
    } while (cursor !== 0);
    
    return keys;
  } catch (error) {
    console.error(`Error scanning Redis keys: ${error.message}`);
    return [];
  }
}

module.exports = {
  getChatHistory,
  saveChatHistory,
  deleteChatHistory,
  clearOldCache,
  CHAT_HISTORY_TTL
};
