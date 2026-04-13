/**
 * Complete authentication middleware that checks both login and optional MFA status
 * MFA is now optional - only enforced if user has explicitly enabled it
 */

module.exports = {
  // Basic authentication check
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    // For API requests, return JSON error instead of redirect
    if (req.path.startsWith('/api') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Store original URL for redirect after login
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  },

  // MFA verification check (only for users who have MFA enabled)
  ensureMfaVerified: function(req, res, next) {
    // Must be authenticated first
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }

    // Skip MFA for OAuth logins (not users with OAuth linked who used password)
    // For backward compatibility: if loginMethod is not set, treat as OAuth if user has googleId (legacy sessions)
    const isOAuthLogin = req.session.loginMethod === 'oauth' ||
                        (!req.session.loginMethod && req.user.googleId && req.user.googleId.trim() !== '');
    if (isOAuthLogin) {
      return next();
    }

    // Only enforce MFA if user has explicitly enabled it
    if (req.user.mfaEnabled) {
      // If MFA not verified in this session, redirect to verification
      if (!req.session.mfaVerified) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/mfa-verify');
      }
    }

    // All checks passed or MFA not enabled
    return next();
  },

  // Combined middleware for routes that need authentication (MFA optional)
  ensureFullAuth: function(req, res, next) {
    // Accept JWT-authenticated requests (for API access)
    if (req.isJWTAuthenticated) {
      return next();
    }

    // Debug logging
    console.log('[AUTH] ensureFullAuth - User:', req.user?.email, 'Authenticated:', req.isAuthenticated?.());
    console.log('[AUTH] MFA Status - Enabled:', req.user?.mfaEnabled, 'Verified:', req.session?.mfaVerified);
    console.log('[AUTH] OAuth User - Google:', !!(req.user?.googleId));

    // Check basic authentication
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      console.log('[AUTH] User not authenticated, redirecting to login');
      req.session.returnTo = req.originalUrl;

      // Detect mobile/API requests
      const userAgent = req.get('User-Agent') || '';
      const isMobile = /Capacitor|Android|iPhone|Mobile/i.test(userAgent) ||
                      req.headers['x-platform'] === 'android' ||
                      req.headers['x-platform'] === 'ios' ||
                      req.query.platform === 'android';

      // For AJAX requests or mobile apps, return JSON error instead of redirect
      if (req.xhr || req.headers.accept === 'application/json' || isMobile) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    }

    // Skip MFA requirements for OAuth logins only (not users with OAuth linked who used password)
    // For backward compatibility: if loginMethod is not set, treat as OAuth if user has googleId (legacy sessions)
    const isOAuthLogin = req.session.loginMethod === 'oauth' ||
                        (!req.session.loginMethod && req.user.googleId && req.user.googleId.trim() !== '');

    if (isOAuthLogin) {
      console.log('[AUTH] OAuth login detected, skipping MFA:', req.user.email);
      return next();
    }

    // MFA is now opt-in only - only enforce if user has explicitly enabled it
    if (req.user.mfaEnabled) {
      console.log('[AUTH] User has MFA enabled, checking verification');

      // User has opted into MFA, so verify it's completed in this session
      if (!req.session.mfaVerified) {
        console.log('[AUTH] MFA not verified in session, redirecting');
        req.session.returnTo = req.originalUrl;

        // Detect mobile/API requests
        const userAgent = req.get('User-Agent') || '';
        const isMobile = /Capacitor|Android|iPhone|Mobile/i.test(userAgent) ||
                        req.headers['x-platform'] === 'android' ||
                        req.headers['x-platform'] === 'ios' ||
                        req.query.platform === 'android';

        // For AJAX requests or mobile apps, return JSON error
        if (req.xhr || req.headers.accept === 'application/json' || isMobile) {
          return res.status(401).json({
            error: 'MFA verification required',
            mfa_required: true
          });
        }
        return res.redirect('/auth/mfa-verify');
      }
      console.log('[AUTH] MFA verified, proceeding');
    } else {
      console.log('[AUTH] User has MFA disabled (optional), proceeding');
    }

    // User is authenticated and either:
    // 1. Has no MFA enabled (optional MFA)
    // 2. Is an OAuth user (Google/GitHub)
    // 3. Has completed MFA verification
    console.log('[AUTH] All checks passed');
    return next();
  },

  // Middleware for admin routes
  ensureAdmin: function(req, res, next) {
    // First ensure full authentication
    module.exports.ensureFullAuth(req, res, function() {
      // Then check admin status
      if (req.user && req.user.isAdmin) {
        return next();
      }
      // Not an admin
      return res.status(403).json({ error: 'Admin access required' });
    });
  }
};