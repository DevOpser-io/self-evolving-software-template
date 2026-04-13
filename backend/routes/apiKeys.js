/**
 * API Keys Routes
 * Allows users to create and manage API keys for programmatic access
 */
const express = require('express');
const router = express.Router();
const db = require('../models');

/**
 * Middleware to check authentication
 */
function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/api-keys
 * List all API keys for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const apiKeys = await db.ApiKey.findAll({
      where: { user_id: userId },
      attributes: ['id', 'name', 'key_prefix', 'scopes', 'site_id', 'last_used_at', 'expires_at', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    res.json({ apiKeys });

  } catch (error) {
    console.error('[API Keys] Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, siteId, scopes, expiresAt } = req.body;

    // Validate name
    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({ error: 'Name is required (1-100 characters)' });
    }

    // Validate site ownership if siteId provided
    if (siteId) {
      const site = await db.Site.findOne({
        where: { id: siteId, user_id: userId }
      });
      if (!site) {
        return res.status(404).json({ error: 'Site not found or access denied' });
      }
    }

    // Validate scopes
    const validScopes = ['leads:read', 'leads:write', 'sites:read'];
    const requestedScopes = scopes || ['leads:read'];
    const invalidScopes = requestedScopes.filter(s => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        error: 'Invalid scopes',
        validScopes,
        invalidScopes
      });
    }

    // Generate the API key
    const { fullKey, keyPrefix, keyHash } = db.ApiKey.generateKey();

    // Create the API key record
    const apiKey = await db.ApiKey.create({
      user_id: userId,
      site_id: siteId || null,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: requestedScopes,
      expires_at: expiresAt ? new Date(expiresAt) : null
    });

    console.log(`[API Keys] Created key ${keyPrefix}... for user ${userId}`);

    // Return the full key - THIS IS THE ONLY TIME IT'S SHOWN
    res.status(201).json({
      success: true,
      message: 'API key created. Save this key - it will not be shown again!',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey,  // Only shown once!
        keyPrefix: apiKey.key_prefix,
        scopes: apiKey.scopes,
        siteId: apiKey.site_id,
        expiresAt: apiKey.expires_at,
        createdAt: apiKey.created_at
      }
    });

  } catch (error) {
    console.error('[API Keys] Error creating key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * DELETE /api/api-keys/:keyId
 * Revoke an API key
 */
router.delete('/:keyId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;

    const apiKey = await db.ApiKey.findOne({
      where: { id: keyId, user_id: userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Soft delete - just deactivate
    apiKey.is_active = false;
    await apiKey.save();

    console.log(`[API Keys] Revoked key ${apiKey.key_prefix}... for user ${userId}`);

    res.json({ success: true, message: 'API key revoked' });

  } catch (error) {
    console.error('[API Keys] Error revoking key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

/**
 * PATCH /api/api-keys/:keyId
 * Update an API key (name, scopes)
 */
router.patch('/:keyId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { keyId } = req.params;
    const { name, scopes, isActive } = req.body;

    const apiKey = await db.ApiKey.findOne({
      where: { id: keyId, user_id: userId }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Update fields
    if (name !== undefined) {
      if (name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be 1-100 characters' });
      }
      apiKey.name = name;
    }

    if (scopes !== undefined) {
      const validScopes = ['leads:read', 'leads:write', 'sites:read'];
      const invalidScopes = scopes.filter(s => !validScopes.includes(s));
      if (invalidScopes.length > 0) {
        return res.status(400).json({ error: 'Invalid scopes', invalidScopes });
      }
      apiKey.scopes = scopes;
    }

    if (isActive !== undefined) {
      apiKey.is_active = isActive;
    }

    await apiKey.save();

    res.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.key_prefix,
        scopes: apiKey.scopes,
        isActive: apiKey.is_active
      }
    });

  } catch (error) {
    console.error('[API Keys] Error updating key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

module.exports = router;
