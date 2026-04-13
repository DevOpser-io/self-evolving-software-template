/**
 * Main application routes
 */
const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const chatRoutes = require('./chat');
const apiRoutes = require('./api');
const { ensureFullAuth } = require('../middleware/authMiddleware');
const { User, Site, Lead, ApiKey } = require('../models');

// Root route - landing page with builder interface (no auth required to view)
router.get('/', (req, res) => {
  // Render the landing builder - works for both authenticated and unauthenticated users
  res.render('landing-builder', {
    user: req.isAuthenticated && req.isAuthenticated() ? req.user : null,
    cspNonce: res.locals.cspNonce || ''
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Account settings page
router.get('/account', (req, res) => {
  // Ensure user is authenticated and MFA verified
  if (!req.isAuthenticated() || !req.session.mfaVerified) {
    req.session.returnTo = '/account';
    return res.redirect('/auth/login');
  }

  // Get current user
  const user = req.user;

  // Render account settings page
  res.render('account', {
    user: user,
    title: 'Account Settings',
    error: req.flash('error'),
    message: req.flash('message'),
    csrfToken: req.csrfToken ? req.csrfToken() : ''
  });
});

// Delete account
router.post('/account/delete', async (req, res) => {
  // Ensure user is authenticated and MFA verified
  if (!req.isAuthenticated() || !req.session.mfaVerified) {
    return res.redirect('/auth/login');
  }

  const userId = req.user.id;
  console.log(`[Account] Starting account deletion for user ${userId}`);

  try {
    // Fetch the full user object
    const user = await User.findByPk(userId);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/account');
    }

    // Step 1: Tear down per-user infrastructure for your deployment target
    // here. The original template closed a per-user AWS account provisioned
    // via AWS Organizations; that flow has been removed in favor of BYO
    // deployment (see AGENTS.md).
    if (user.awsAccountId) {
      console.log(`[Account] Skipping per-user teardown for ${user.awsAccountId} — not configured`);
    }

    // Step 2: Deactivate all user's sites (set to draft and clear published config)
    const sites = await Site.findAll({ where: { userId } });
    console.log(`[Account] Deactivating ${sites.length} sites`);

    for (const site of sites) {
      await site.update({
        status: 'draft',
        deploymentStatus: 'none',
        publishedConfig: null,
        lightsailUrl: null
      });
    }

    // Step 3: Delete all leads for the user's sites
    const siteIds = sites.map(s => s.id);
    if (siteIds.length > 0) {
      const leadsDeleted = await Lead.destroy({ where: { siteId: siteIds } });
      console.log(`[Account] Deleted ${leadsDeleted} leads`);
    }

    // Step 4: Delete all API keys
    const apiKeysDeleted = await ApiKey.destroy({ where: { userId } });
    console.log(`[Account] Deleted ${apiKeysDeleted} API keys`);

    // Step 5: Anonymize the user record (keep for audit trail, remove PII)
    const deletedEmail = `deleted-${userId}-${Date.now()}@deleted.local`;
    await user.update({
      email: deletedEmail,
      name: 'Deleted User',
      googleId: null,
      profilePicture: null,
      mfaSecret: null,
      mfaEnabled: false,
      awsAccountStatus: 'closed'
    });

    console.log(`[Account] User ${userId} account deleted successfully`);

    // Step 6: Log out and destroy session
    req.logout(function(err) {
      if (err) {
        console.error('[Account] Logout error:', err);
      }
      req.session.destroy(function(err) {
        if (err) {
          console.error('[Account] Session destroy error:', err);
        }
        // Redirect to homepage with a message
        res.redirect('/?deleted=1');
      });
    });

  } catch (error) {
    console.error(`[Account] Error deleting account for user ${userId}:`, error);
    req.flash('error', 'Failed to delete account. Please try again or contact support.');
    res.redirect('/account');
  }
});

// Mount API routes (no authentication required for basic info endpoints)
router.use('/api', apiRoutes);

// Mount auth routes
router.use('/auth', authRoutes);

// Apply full authentication (login + MFA) to all chat routes
router.use('/chat', ensureFullAuth);
router.use('/api/chat', ensureFullAuth);

// Mount chat routes (already have ensureAuthenticated in them)
router.use('/', chatRoutes);

module.exports = router;
