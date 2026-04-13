/**
 * Admin Authentication and Authorization Middleware
 * Replaces AdminJS authentication with custom secure middleware
 */

/**
 * Middleware to ensure user is authenticated, MFA verified, and has admin privileges
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  // Check if user is authenticated
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.log('Unauthenticated access attempt to admin panel');
    // Store the original URL they were trying to access
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  // Check if MFA is verified
  if (!req.session.mfaVerified) {
    console.log('User needs to verify MFA before accessing admin panel');
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/mfa-verify');
  }

  // Check if user has admin privileges
  if (!req.user || !req.user.isAdmin) {
    console.log(`User ${req.user ? req.user.email : 'unknown'} attempted to access admin panel without admin privileges`);
    return res.status(403).render('error', { 
      message: 'Access Denied', 
      error: { status: 403, stack: 'You do not have permission to access the admin panel.' } 
    });
  }

  // User is authenticated, MFA verified, and has admin privileges
  console.log(`Admin access granted to ${req.user.email}`);
  next();
};

/**
 * Middleware to ensure admin API requests are authenticated and authorized
 * Returns JSON responses instead of redirects for AJAX requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdminAPI = (req, res, next) => {
  // Check if user is authenticated
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  // Check if MFA is verified
  if (!req.session.mfaVerified) {
    return res.status(401).json({ 
      success: false, 
      message: 'MFA verification required' 
    });
  }

  // Check if user has admin privileges
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin privileges required' 
    });
  }

  // User is authenticated, MFA verified, and has admin privileges
  next();
};

/**
 * Middleware to log admin actions for security auditing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const logAdminAction = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userEmail = req.user ? req.user.email : 'unknown';
  const action = `${req.method} ${req.originalUrl}`;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[ADMIN_AUDIT] ${timestamp} | User: ${userEmail} | IP: ${ip} | Action: ${action}`);
  
  // Log request body for POST/PUT/PATCH requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields from logs
    delete sanitizedBody.password;
    delete sanitizedBody.passwordHash;
    delete sanitizedBody.mfaSecret;
    
    console.log(`[ADMIN_AUDIT] Request body:`, sanitizedBody);
  }
  
  next();
};

/**
 * Error handling middleware for admin routes
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const adminErrorHandler = (err, req, res, next) => {
  console.error('Admin panel error:', err);
  
  // Log error details for admin actions
  const timestamp = new Date().toISOString();
  const userEmail = req.user ? req.user.email : 'unknown';
  const action = `${req.method} ${req.originalUrl}`;
  
  console.error(`[ADMIN_ERROR] ${timestamp} | User: ${userEmail} | Action: ${action} | Error: ${err.message}`);
  
  if (req.xhr || req.headers.accept === 'application/json') {
    // API request - return JSON error
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } else {
    // Regular request - render error page
    res.status(500).render('error', {
      message: 'Admin Panel Error',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  }
};

module.exports = {
  requireAdmin,
  requireAdminAPI,
  logAdminAction,
  adminErrorHandler
};