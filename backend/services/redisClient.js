// redisClient.js

const redis = require('redis');
const config = require('../config');

class RedisClient {
  constructor() {
    // Create Redis client (modern v4 API)
    this.client = redis.createClient({
      url: config.redis.url
    });

    this.client.on('error', (error) => {
      console.error(`Redis client error: ${error.message}`);
    });

    this.client.on('connect', () => {
      console.info('Redis client connected');
    });
    this.client.on('ready', () => {
      console.info('Redis client ready to use');
    });
    // Connect using promise-based API
    this.client.connect()
      .then(() => console.info('Redis client connection established'))
      .catch(err => console.error(`Redis client connection error: ${err.message}`));
  }

  async getChatHistory(conversationId) {
    try {
      const cacheVersion = config.cache.version;
      const redisKey = `chat:${cacheVersion}:${conversationId}`;
      
      console.info(`[CHAT_HISTORY] Attempting to get chat history for conversation ${conversationId}`);
      console.debug(`[CHAT_HISTORY] Using Redis key: ${redisKey}`);
      
      const chatHistoryJson = await this.client.get(redisKey);
      
      if (chatHistoryJson) {
        const history = JSON.parse(chatHistoryJson);
        console.info(`[CHAT_HISTORY] Successfully loaded history for ${conversationId}, length: ${history.length}`);
        console.debug(`[CHAT_HISTORY] Full history content: ${JSON.stringify(history, null, 2)}`);
        return history;
      } else {
        console.info(`[CHAT_HISTORY] No existing history found for conversation ${conversationId}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`[CHAT_HISTORY] JSON decode error for ${conversationId}: ${error.message}`);
      } else {
        console.error(`[CHAT_HISTORY] Unexpected error for ${conversationId}: ${error.message}`);
      }
    }
    
    // Return empty array by default
    console.info(`[CHAT_HISTORY] Returning empty history for conversation ${conversationId}`);
    return [];
  }

  async saveChatHistory(conversationId, chatHistory) {
    try {
      const cacheVersion = config.cache.version;
      const chatHistoryJson = JSON.stringify(chatHistory);
      
      await this.client.setEx(
        `chat:${cacheVersion}:${conversationId}`,
        config.cache.ttl,
        chatHistoryJson
      );
      
      console.info(`Successfully saved chat history to Redis for conversation ${conversationId}`);
    } catch (error) {
      console.error(`Error saving chat history to Redis: ${error.message}`);
    }
  }

  async deleteChatHistory(conversationId) {
    try {
      const cacheVersion = config.cache.version;
      const redisKey = `chat:${cacheVersion}:${conversationId}`;
      
      await this.client.del(redisKey);
      console.info(`Successfully deleted chat history from Redis for conversation ${conversationId}`);
    } catch (error) {
      console.error(`Error deleting chat history from Redis: ${error.message}`);
    }
  }

  async clearOldCache() {
    try {
      // Check if client is connected before attempting to clear cache
      if (!this.client.isReady) {
        console.warn('Redis client not ready, skipping cache clearing');
        return;
      }
      
      const currentVersion = config.cache.version;
      console.info(`Clearing old cache for versions other than ${currentVersion}`);
      
      // Helper function to safely scan keys
      const scanAndDeleteKeys = async (pattern) => {
        let cursor = '0';
        do {
          // Redis v4 scan returns an object with cursor and keys properties
          const scanResult = await this.client.scan(cursor, {
            MATCH: pattern,
            COUNT: 100
          });
          
          // Extract cursor and keys from the scan result
          if (scanResult && scanResult.keys) {
            cursor = scanResult.cursor.toString();
            const keys = scanResult.keys;
            
            // Delete keys that don't match the current version
            for (const key of keys) {
              if (!key.startsWith(`${pattern.split(':')[0]}:${currentVersion}:`)) {
                await this.client.del(key);
              }
            }
          } else {
            // Break the loop if scan result is invalid
            console.warn(`Invalid scan result for pattern ${pattern}`);
            break;
          }
        } while (cursor !== '0');
      };
      
      // Scan and delete chat keys
      await scanAndDeleteKeys('chat:*');
      
      // Scan and delete session keys
      await scanAndDeleteKeys('session:*');
      
      console.info(`Old cache cleared for version ${currentVersion}`);
    } catch (error) {
      console.error(`Redis error when clearing old cache: ${error.message}`);
    }
  }
  
  /**
   * Get the Redis client instance for use with session store
   * @returns {Object} Redis client instance
   */
  getClient() {
    return this.client;
  }
}

// Create and export a singleton instance
const redisClient = new RedisClient();
module.exports = redisClient;
