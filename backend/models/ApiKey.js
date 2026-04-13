/**
 * ApiKey Model
 * Stores API keys for programmatic access to site data (leads, etc.)
 */
const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    site_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // null = access to all user's sites
      references: {
        model: 'sites',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'User-friendly name for the API key'
    },
    key_prefix: {
      type: DataTypes.STRING(8),
      allowNull: false,
      comment: 'First 8 chars of the key for identification (e.g., "dol_abc1")'
    },
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'SHA-256 hash of the full API key'
    },
    scopes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['leads:read'],
      comment: 'Array of permission scopes: leads:read, leads:write, sites:read'
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Optional expiration date'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'api_keys',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['site_id'] },
      { fields: ['key_hash'], unique: true },
      { fields: ['key_prefix'] },
      { fields: ['is_active'] }
    ]
  });

  /**
   * Generate a new API key
   * Returns both the raw key (to show user once) and the model data
   */
  ApiKey.generateKey = function() {
    // Format: dol_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars)
    const prefix = 'dol_';
    const randomPart = crypto.randomBytes(24).toString('base64url').slice(0, 32);
    const fullKey = prefix + randomPart;
    const keyPrefix = fullKey.slice(0, 8); // "dol_xxxx"
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    return {
      fullKey,      // Return to user ONCE - never stored
      keyPrefix,    // Stored for display/identification
      keyHash       // Stored for verification
    };
  };

  /**
   * Verify an API key
   */
  ApiKey.verifyKey = async function(apiKey) {
    if (!apiKey || !apiKey.startsWith('dol_')) {
      return null;
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await ApiKey.findOne({
      where: {
        key_hash: keyHash,
        is_active: true
      }
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Check expiration
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      return null;
    }

    // Update last used
    apiKeyRecord.last_used_at = new Date();
    await apiKeyRecord.save();

    return apiKeyRecord;
  };

  /**
   * Check if key has a specific scope
   */
  ApiKey.prototype.hasScope = function(scope) {
    return this.scopes && this.scopes.includes(scope);
  };

  return ApiKey;
};
