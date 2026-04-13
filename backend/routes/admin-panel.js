/**
 * Custom Admin Panel Routes
 * Secure CSP-compliant admin interface replacing AdminJS
 */
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const db = require('../models');
const { requireAdmin, requireAdminAPI, logAdminAction, adminErrorHandler } = require('../middleware/adminMiddleware');

// Apply admin middleware to all routes
router.use(requireAdmin);
router.use(logAdminAction);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    // Verify models are available
    if (!db.User || !db.Conversation) {
      throw new Error('Database models not properly initialized');
    }
    
    // Get admin statistics
    const userCount = await db.User.count();
    const adminCount = await db.User.count({ where: { isAdmin: true } });
    const verifiedUserCount = await db.User.count({ where: { emailVerified: true } });
    const conversationCount = await db.Conversation.count({
      where: db.sequelize.where(
        db.sequelize.fn('jsonb_array_length', db.sequelize.col('chat_history')),
        '>',
        1
      )
    });
    const recentUsers = await db.User.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'email', 'name', 'createdAt', 'emailVerified', 'isAdmin']
    });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        userCount,
        adminCount,
        verifiedUserCount,
        conversationCount
      },
      recentUsers
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('error', {
      message: 'Failed to load admin dashboard',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// User management
router.get('/users', async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const { count, rows: users } = await db.User.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'email', 'name', 'createdAt', 'emailVerified', 'isAdmin', 'mfaEnabled']
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/users', {
      title: 'User Management',
            users,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      }
    });
  } catch (error) {
    console.error('User management error:', error);
    res.status(500).render('error', {
      message: 'Failed to load users',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Create user form
router.get('/users/create', async (req, res) => {
  try {
    res.render('admin/create-user', {
      title: 'Create New User',
      user: req.user,
      error: req.flash('error'),
      message: req.flash('message')
    });
  } catch (error) {
    console.error('Create user form error:', error);
    res.status(500).render('error', {
      message: 'Failed to load create user form',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Create user POST
router.post('/users/create', requireAdminAPI, async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const { email, name, password, confirmPassword, isAdmin, emailVerified } = req.body;
    
    // Validation
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      return res.redirect('/admin-panel/users/create');
    }
    
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/admin-panel/users/create');
    }
    
    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters long');
      return res.redirect('/admin-panel/users/create');
    }
    
    // Check if user already exists
    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      req.flash('error', 'A user with this email already exists');
      return res.redirect('/admin-panel/users/create');
    }
    
    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const newUser = await db.User.create({
      email,
      name: name || null,
      passwordHash,
      isAdmin: isAdmin === 'on',
      emailVerified: emailVerified === 'on',
      mfaEnabled: false,
      hasAuthenticator: false,
      isMfaSetupComplete: false
    });
    
    req.flash('message', `User ${email} created successfully`);
    res.redirect(`/admin-panel/users/${newUser.id}`);
  } catch (error) {
    console.error('Create user error:', error);
    req.flash('error', 'Failed to create user: ' + error.message);
    res.redirect('/admin-panel/users/create');
  }
});

// User details
router.get('/users/:id', async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const viewedUser = await db.User.findByPk(req.params.id, {
      attributes: ['id', 'email', 'name', 'createdAt', 'emailVerified', 'isAdmin', 'mfaEnabled']
    });
    
    if (!viewedUser) {
      return res.status(404).render('error', {
        message: 'User not found',
        error: { status: 404 }
      });
    }

    const userConversations = await db.Conversation.findAll({
      where: { user_id: viewedUser.id },
      order: [['started_at', 'DESC']],
      limit: 10,
      attributes: ['conversation_id', 'started_at', 'ended_at', 'is_temporary']
    });

    res.render('admin/user-detail', {
      title: `User: ${viewedUser.email}`,
      viewedUser: viewedUser,
      conversations: userConversations,
      user: req.user // Explicitly pass logged-in user
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).render('error', {
      message: 'Failed to load user details',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Toggle user admin status
router.post('/users/:id/toggle-admin', requireAdminAPI, async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent removing admin status from yourself
    if (user.id === req.user.id && user.isAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot remove your own admin privileges' 
      });
    }

    user.isAdmin = !user.isAdmin;
    await user.save();

    res.json({ 
      success: true, 
      isAdmin: user.isAdmin,
      message: `User ${user.isAdmin ? 'granted' : 'removed'} admin privileges`
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Toggle email verification
router.post('/users/:id/toggle-verified', requireAdminAPI, async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.emailVerified = !user.emailVerified;
    await user.save();

    res.json({ 
      success: true, 
      emailVerified: user.emailVerified,
      message: `User email ${user.emailVerified ? 'verified' : 'unverified'}`
    });
  } catch (error) {
    console.error('Toggle verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Conversations management
router.get('/conversations', async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const { count, rows: conversations } = await db.Conversation.findAndCountAll({
      where: db.sequelize.where(
        db.sequelize.fn('jsonb_array_length', db.sequelize.col('chat_history')),
        '>',
        1 // Only show conversations with more than 1 message (system prompt + at least one user message)
      ),
      order: [['started_at', 'DESC']],
      limit,
      offset,
      include: [{
        model: db.User,
        attributes: ['email', 'name']
      }],
      attributes: ['conversation_id', 'user_id', 'started_at', 'ended_at', 'is_temporary']
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/conversations', {
      title: 'Conversation Management',
      layout: 'admin/layout',
      conversations,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      }
    });
  } catch (error) {
    console.error('Conversation management error:', error);
    res.status(500).render('error', {
      message: 'Failed to load conversations',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Delete user
router.delete('/users/:id', requireAdminAPI, async (req, res) => {
  try {
    // Ensure database is initialized before accessing models
    await db.initializeDatabase();
    
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
    }

    // Also delete any conversations associated with this user
    await db.Conversation.destroy({
      where: { user_id: user.id }
    });

    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Note: Conversation deletion removed for security reasons
// Conversations are managed automatically by the system

// Apply error handler
router.use(adminErrorHandler);

module.exports = router;