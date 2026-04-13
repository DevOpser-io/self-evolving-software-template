/**
 * Middleware to ensure MFA is verified (if enabled)
 * MFA is optional - users can enable it in account settings
 */
module.exports = function ensureMfaCompleted(req, res, next) {
  // User must be authenticated first
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/auth/login');
  }

  // Check if MFA is enabled but not verified for this session
  if (req.user.mfaEnabled && !req.session.mfaVerified) {
    // Store the original URL for redirection after MFA verification
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/mfa-verify');
  }

  // MFA is optional - if not enabled, user can proceed
  // User is authenticated and MFA is either verified or not enabled
  return next();
};
