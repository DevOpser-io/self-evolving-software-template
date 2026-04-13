/**
 * Chat Routes
 * Handles all chat-related endpoints
 */
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { ensureFullAuth } = require('../middleware/authMiddleware');
const { mobileAuth } = require('../middleware/mobileAuth');

// Add local body-parser middleware for chat routes
// This is needed because the global body-parser is added after AdminJS setup
router.use(express.json());
router.use(express.urlencoded({ extended: false }));

// Main page - landing builder (no auth required to view)
router.get('/', (req, res) => {
  res.render('landing-builder', {
    user: req.isAuthenticated && req.isAuthenticated() ? req.user : null,
    cspNonce: res.locals.cspNonce || ''
  });
});

router.get('/chat', ensureFullAuth, async (req, res) => {
  try {
    res.render('chat', {
      title: 'Chat | Bedrock Express AI',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    res.render('chat', {
      title: 'Chat | Bedrock Express AI',
      user: req.user || null
    });
  }
});

// API routes for chat functionality - support both web auth and mobile API key auth

// Process a chat message (for streaming flow - doesn't generate response, just sets up for streaming)
router.post('/api/chat/message', mobileAuth({ optional: true }), ensureFullAuth, chatController.processMessage);

// Stream a chat response (accepts both GET and POST)
router.post('/api/chat/stream', mobileAuth({ optional: true }), ensureFullAuth, chatController.streamResponse);
router.get('/api/chat/stream', mobileAuth({ optional: true }), ensureFullAuth, chatController.streamResponse);

// Legacy routes for backward compatibility
router.post('/chat', ensureFullAuth, chatController.processMessage);
router.get('/stream', mobileAuth({ optional: true }), ensureFullAuth, chatController.streamResponse);

// Get all conversations (chat history)
router.get('/conversation_history', mobileAuth({ optional: true }), ensureFullAuth, chatController.getConversations);

// Get a specific conversation by ID
router.get('/get_conversation/:conversationId', mobileAuth({ optional: true }), ensureFullAuth, chatController.getConversation);

// Reset/clear the current conversation
router.post('/reset', mobileAuth({ optional: true }), ensureFullAuth, chatController.resetConversation);

module.exports = router;
