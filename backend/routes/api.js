/**
 * API Routes
 * General API endpoints not specific to chat functionality
 */
const express = require('express');
const router = express.Router();
const { getAdditionalSecrets } = require('../services/secretsManager');

// Add local body-parser middleware for API routes
// This is needed because the global body-parser is added after AdminJS setup
router.use(express.json());
router.use(express.urlencoded({ extended: false }));

// Health check endpoint - available at both /api/health and /api (for backward compatibility)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root health check for backward compatibility
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Information
router.get('/info', (req, res) => {
  res.json({
    name: 'Bedrock Express API',
    version: '1.0.0',
    description: 'Express.js backend for Bedrock AI Chat application',
  });
});

// Debug endpoint to check user admin status
router.get('/debug/user', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, message: 'Not authenticated' });
  }
  
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      isAdmin: req.user.isAdmin,
      emailVerified: req.user.emailVerified,
      mfaEnabled: req.user.mfaEnabled
    }
  });
});

// Test route to verify ADDITIONAL_SECRETS environment variable parsing
router.get('/test-secrets', async (req, res) => {
  try {
    const domainCreds = await getAdditionalSecrets();
    
    // Add debug logging
    console.log(`Type of retrieved secret: ${typeof domainCreds}`);
    console.log(`Content of secret:`, domainCreds); // Be careful with this in production!
    
    // Create a safe response that doesn't expose sensitive data
    const safeResponse = {
      status: 'success',
      secret_type: typeof domainCreds,
      is_dict: typeof domainCreds === 'object' && domainCreds !== null,
      available_keys: typeof domainCreds === 'object' && domainCreds !== null ? Object.keys(domainCreds) : null,
      string_length: typeof domainCreds === 'string' ? domainCreds.length : null
    };
    
    console.log('Successfully retrieved and verified secret structure');
    return res.json(safeResponse);
    
  } catch (error) {
    // Handle missing environment variable or parsing errors
    if (error.message.includes('ADDITIONAL_SECRETS environment variable is not set')) {
      return res.status(400).json({
        status: 'error',
        message: error.message,
        error_type: 'configuration_error'
      });
    }
    
    // Handle other errors
    console.error(`Error testing secrets: ${error.message}`, error);
    return res.status(500).json({
      status: 'error',
      message: `Failed to retrieve secrets: ${error.message}`,
      error_type: 'internal_error'
    });
  }
});

module.exports = router;
