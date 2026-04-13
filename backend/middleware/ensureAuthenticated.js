// Middleware to ensure a user is authenticated
module.exports = function ensureAuthenticated(req, res, next) {
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

  // For regular page requests, redirect to login
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
};
