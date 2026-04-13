/**
 * FILE: backend/routes/preview.js
 * PURPOSE: Anonymous preview generation for landing page
 * DESCRIPTION: Allows unauthenticated users to generate a website preview
 *              to see value before signing up
 */

const express = require('express');
const router = express.Router();
const { generateSiteFromDescription } = require('../services/websiteAgentServiceV2');

// Rate limiting for anonymous preview generation
const previewRateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_PREVIEWS_PER_WINDOW = 3;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = previewRateLimits.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    previewRateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_PREVIEWS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of previewRateLimits.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW * 2) {
      previewRateLimits.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

/**
 * POST /api/preview/generate
 * Generate a website preview without authentication
 * Rate limited to prevent abuse
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a description of your website (at least 5 characters)'
      });
    }

    // Rate limit check
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: 'Too many preview requests. Please sign up to continue building your website!'
      });
    }

    console.log(`[Preview] Generating anonymous preview for IP: ${clientIp}`);

    // Generate site config using AI
    const result = await generateSiteFromDescription(prompt.trim());

    if (!result.newConfig || !result.newConfig.sections || result.newConfig.sections.length === 0) {
      return res.status(200).json({
        success: true,
        config: null,
        message: "I couldn't generate a preview from that description. Try being more specific about what kind of website you want!"
      });
    }

    console.log(`[Preview] Generated preview with ${result.newConfig.sections.length} sections`);

    res.json({
      success: true,
      config: result.newConfig,
      message: result.message || "Here's your website preview! Sign up to save it, make more changes, and publish it live."
    });

  } catch (error) {
    console.error('[Preview] Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Something went wrong generating your preview. Please try again.'
    });
  }
});

module.exports = router;
