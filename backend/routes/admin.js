/**
 * Admin Routes
 * Routes for accessing the admin panel
 */
const express = require('express');
const router = express.Router();

// Admin dashboard access
router.get('/', (req, res) => {
  // Check if user is authenticated, MFA verified, and is admin
  if (!req.user || !req.user.isAdmin) {
    console.log('User not authorized for admin access:', req.user ? req.user.email : 'not authenticated');
    return res.status(403).render('error', { 
      message: 'Access Denied', 
      error: { status: 403, stack: 'You do not have permission to access this page.' } 
    });
  }
  
  // Check if MFA is verified
  if (!req.session.mfaVerified) {
    console.log('User needs to verify MFA before accessing admin panel');
    req.session.returnTo = '/admin-panel'; // After MFA verification, redirect to admin panel
    return res.redirect('/auth/mfa-verify');
  }
  
  // Redirect to custom admin panel
  res.redirect('/admin-panel');
});

// Direct admin panel access - this will be the link in the navigation menu
router.get('/panel', (req, res) => {
  // Log access attempt
  console.log('Admin panel access attempt by:', req.user ? req.user.email : 'not authenticated');
  console.log('User admin status:', req.user ? req.user.isAdmin : false);
  
  // Check if user is authenticated and is admin
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).render('error', { 
      message: 'Access Denied', 
      error: { status: 403, stack: 'You do not have permission to access the admin panel.' } 
    });
  }
  
  // Check if MFA is verified
  if (!req.session.mfaVerified) {
    console.log('User needs to verify MFA before accessing admin panel');
    req.session.returnTo = '/admin'; // After MFA verification, redirect to admin panel
    return res.redirect('/auth/mfa-verify');
  }
  
  // Redirect to AdminJS panel
  res.redirect('/admin');
});

// Admin access check endpoint
router.get('/check', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, message: 'Not authenticated' });
  }
  
  res.json({
    authenticated: true,
    isAdmin: !!req.user.isAdmin,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      isAdmin: req.user.isAdmin
    }
  });
});

// Custom logout route for admin panel
router.get('/logout', (req, res) => {
  console.log('Admin panel logout route called');
  // Clear MFA verification flag
  if (req.session) {
    delete req.session.mfaVerified;
    // Also clear any conversation data
    if (req.session.conversationId) {
      console.log(`Clearing conversation data for ID: ${req.session.conversationId}`);
      delete req.session.conversationId;
    }
  }
  // Logout using passport
  req.logout(function(err) {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;
