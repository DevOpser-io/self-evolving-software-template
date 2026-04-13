/**
 * Mobile App Link Handler
 * This route handles the HTTPS App Link redirects for mobile apps
 * Path: /mobile/auth
 */
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../models');
const speakeasy = require('speakeasy');
const redisClient = require('../services/redisClient');
const { sendEmail } = require('../services/emailService');

// Add body-parser middleware for this router
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Ensure database is initialized before accessing models
async function ensureDatabaseInitialized() {
  if (process.env.NODE_ENV === 'production' && typeof db.initializeDatabase === 'function') {
    console.log('Ensuring database is initialized before accessing models');
    await db.initializeDatabase();
  }
  return db.User;
}

// GET /mobile/auth (this route handles OAuth callbacks for mobile)
router.get('/', (req, res) => {
  // Extract parameters from the query string
  const params = new URLSearchParams(req.query);

  console.log('=== MOBILE AUTH PAGE DEBUG ===');
  console.log('Request URL:', req.originalUrl);
  console.log('Query params:', req.query);
  console.log('Host:', req.get('host'));
  console.log('Protocol:', req.protocol);
  console.log('Params string:', params.toString());
  console.log('Referer:', req.get('referer'));

  const host = req.get('host');
  const referer = req.get('referer') || '';
  
  // Check if this is the local emulated app (mobile-app.html)
  // The emulated app will have mobile-app.html in the referer
  const isEmulatedApp = referer.includes('mobile-app.html') || 
                        referer.includes('localhost:8000') ||
                        host.includes('localhost');
  
  if (isEmulatedApp && host.includes('localhost')) {
    // For local emulated app, redirect back to mobile-app.html with params
    console.log('[Mobile Auth] Local emulated app detected - redirecting to mobile-app.html');
    const redirectUrl = `/mobile-app.html?${params.toString()}`;
    console.log('[Mobile Auth] Redirecting to:', redirectUrl);
    return res.redirect(redirectUrl);
  }

  // For actual native apps, render the deep link page
  const appLinkUrl = `${req.protocol}://${req.get('host')}/mobile/auth?${params.toString()}`;
  let deepLink;

  if (host.includes('localhost')) {
    // Local: Use custom scheme for reliable app opening
    deepLink = `com.bedrockexpress.app://oauth2redirect?${params.toString()}`;
    console.log('Using custom scheme for local native app');
  } else {
    // Production: Use HTTPS App Links (properly configured certificates)
    deepLink = appLinkUrl;
    console.log('Using HTTPS App Links for production');
  }

  console.log('Generated App Link URL:', appLinkUrl);
  console.log('Generated Deep Link:', deepLink);
  console.log('===============================');

  // Render the template with CSP-compliant external resources
  res.render('mobile-auth', {
    deepLink: deepLink,
    appLinkUrl: appLinkUrl,
    layout: false // Don't use any layout
  });
});

// ============================================
// Magic Link Authentication for Mobile
// ============================================

/**
 * POST /mobile/auth/magic-link/request - Request a magic link code via email
 * This is the mobile-optimized version of magic link authentication
 */
router.post('/magic-link/request',
  [
    body('email').isEmail().normalizeEmail()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address'
        });
      }

      const { email } = req.body;
      console.log(`[Mobile Magic Link] Request for ${email}`);

      // Rate limiting - 1 code per email every 60 seconds
      const rateLimitKey = `magic_link_limit:${email}`;
      const lastSent = await redisClient.client.get(rateLimitKey);

      if (lastSent) {
        const timeSinceLastSent = Date.now() - parseInt(lastSent);
        if (timeSinceLastSent < 60000) {
          return res.status(429).json({
            success: false,
            error: `Please wait ${Math.ceil((60000 - timeSinceLastSent) / 1000)} seconds before requesting another code`
          });
        }
      }

      // Generate random 6-digit code
      const crypto = require('crypto');
      const code = crypto.randomInt(100000, 999999).toString();
      console.log(`[Mobile Magic Link] Generated code for ${email}: ${code}`);

      // Clean up any old "used" keys for this email
      const oldUsedPattern = `magic_link_used:${email}:*`;
      const oldUsedKeys = await redisClient.client.keys(oldUsedPattern);
      if (oldUsedKeys && oldUsedKeys.length > 0) {
        await redisClient.client.del(oldUsedKeys);
      }

      // Store code in Redis with 10-minute expiry
      const codeKey = `magic_link_code:${email}`;
      await redisClient.client.setEx(codeKey, 600, code);

      // Set rate limit
      await redisClient.client.setEx(rateLimitKey, 60, Date.now().toString());

      // Send email with code
      try {
        await sendEmail({
          to: email,
          subject: 'Your verification code',
          text: `Your verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: #446df6; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Bedrock Express AI</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Your Verification Code</h2>
              <p style="color: #666; font-size: 16px; line-height: 24px; margin: 0 0 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Enter this code in the app to sign in:</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 10px 0 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #446df6; font-family: 'Courier New', monospace;">${code}</span>
              </div>
              <p style="color: #999; font-size: 14px; line-height: 20px; margin: 20px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">This code will expire in 10 minutes.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `.trim()
        });

        console.log(`[Mobile Magic Link] Code sent to ${email}`);

        return res.json({
          success: true,
          message: 'Verification code sent! Check your email.'
        });
      } catch (emailError) {
        console.error('[Mobile Magic Link] Failed to send email:', emailError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send email. Please try again.'
        });
      }
    } catch (error) {
      console.error('[Mobile Magic Link] Request error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred. Please try again.'
      });
    }
  }
);

/**
 * POST /mobile/auth/magic-link/verify - Verify magic link code and login
 * Creates or finds user, then logs them in (no MFA required - magic link is sufficient)
 */
router.post('/magic-link/verify',
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email or code format'
        });
      }

      const { email, code, name } = req.body;
      console.log(`[Mobile Magic Link] Verification attempt for ${email}`);

      // Retrieve code from Redis
      const codeKey = `magic_link_code:${email}`;
      const storedCode = await redisClient.client.get(codeKey);

      if (!storedCode) {
        console.log(`[Mobile Magic Link] No code found for ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Code expired or invalid. Please request a new one.'
        });
      }

      if (storedCode !== code) {
        console.log(`[Mobile Magic Link] Code mismatch for ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Incorrect code. Please try again.'
        });
      }

      // Check if code has already been used
      const usedKey = `magic_link_used:${email}:${code}`;
      const wasUsed = await redisClient.client.get(usedKey);

      if (wasUsed) {
        return res.status(401).json({
          success: false,
          error: 'This code has already been used. Please request a new one.'
        });
      }

      // Mark code as used
      await redisClient.client.setEx(usedKey, 300, '1');
      await redisClient.client.del(codeKey);

      // Find or create user
      const User = await ensureDatabaseInitialized();
      let user = await User.findOne({ where: { email } });

      if (!user) {
        // Create new user
        user = await User.create({
          email,
          name: name || email.split('@')[0],
          emailVerified: true,
          lastLogin: new Date()
        });
        console.log(`[Mobile Magic Link] New user created: ${email}`);
      } else {
        // Update existing user
        user.emailVerified = true;
        user.lastLogin = new Date();
        await user.save();
        console.log(`[Mobile Magic Link] Existing user logged in: ${email}`);
      }

      // Magic link login bypasses MFA (email verification is sufficient)
      // Log the user in directly
      req.login(user, async (loginErr) => {
        if (loginErr) {
          console.error('[Mobile Magic Link] Login error:', loginErr);
          return res.status(500).json({
            success: false,
            error: 'Authentication failed'
          });
        }

        // Mark session as verified (magic link is sufficient)
        req.session.mfaVerified = true;
        req.session.loginMethod = 'magic_link';

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[Mobile Magic Link] Session save error:', saveErr);
          }

          console.log(`[Mobile Magic Link] User ${email} logged in successfully`);

          return res.json({
            success: true,
            authenticated: true,
            message: 'Sign-in successful!',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              emailVerified: user.emailVerified
            }
          });
        });
      });

    } catch (error) {
      console.error('[Mobile Magic Link] Verify error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred. Please try again.'
      });
    }
  }
);

/**
 * POST /mobile/auth/login - Mobile native login with JSON response
 * This endpoint provides JSON responses for mobile apps instead of HTML redirects
 * NOTE: This is kept for backward compatibility but magic link is preferred
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 72 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array().map(e => e.msg).join(', ')
        });
      }

      const { email, password, platform, deviceId } = req.body;
      const User = await ensureDatabaseInitialized();
      const user = await User.findOne({ where: { email } });

      // Check credentials
      if (!user || !(await user.checkPassword(password))) {
        return res.status(401).json({
          success: false,
          error: 'Please check your login details.'
        });
      }

      // Check email verification
      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email first.',
          emailVerified: false
        });
      }

      // Check if MFA is required
      if (user.mfaEnabled && user.mfaSecret) {
        console.log(`[Mobile Login] User ${user.id} requires MFA verification`);

        // Create a temporary session in Redis for MFA verification
        const sessionId = require('crypto').randomBytes(32).toString('hex');
        const sessionData = {
          userId: user.id,
          email: user.email,
          platform: platform || 'unknown',
          deviceId: deviceId || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          timestamp: Date.now()
        };

        // Store session in Redis with 5-minute expiry
        await redisClient.client.setEx(
          `mobile_mfa_session:${sessionId}`,
          300,
          JSON.stringify(sessionData)
        );

        console.log(`[Mobile Login] Created MFA session ${sessionId} for user ${user.id}`);

        return res.json({
          success: true,
          mfaRequired: true,
          sessionId: sessionId,
          mfaMethods: ['totp', 'backup'],
          message: 'MFA verification required'
        });
      }

      // If no MFA or MFA not enabled, complete login
      // For mobile apps, we should still require MFA setup
      if (!user.mfaEnabled) {
        return res.status(403).json({
          success: false,
          error: 'MFA setup required. Please complete MFA setup in the web application.',
          mfaSetupRequired: true
        });
      }

      // This shouldn't happen, but just in case
      return res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });

    } catch (err) {
      console.error('[Mobile Login] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'An error occurred during login. Please try again.'
      });
    }
  }
);

/**
 * POST /mobile/auth/mfa-verify - Verify MFA code for mobile login
 * Returns JSON response instead of redirect
 */
router.post('/mfa-verify',
  [
    body('sessionId').notEmpty(),
    body('code').notEmpty(),
    body('method').optional().isIn(['totp', 'backup'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { sessionId, code, method = 'totp' } = req.body;

      // Retrieve session from Redis
      const sessionKey = `mobile_mfa_session:${sessionId}`;
      const sessionDataStr = await redisClient.client.get(sessionKey);

      if (!sessionDataStr) {
        return res.status(401).json({
          success: false,
          error: 'MFA session expired. Please log in again.',
          sessionExpired: true
        });
      }

      const sessionData = JSON.parse(sessionDataStr);

      // Check if session is still valid (additional time check)
      const sessionAge = Date.now() - sessionData.timestamp;
      if (sessionAge > 300000) { // 5 minutes
        try {
          await redisClient.client.del(sessionKey);
        } catch (err) {
          console.log('Could not clean up Redis session:', err.message);
        }
        return res.status(401).json({
          success: false,
          error: 'MFA session expired'
        });
      }

      // Get user
      const User = await ensureDatabaseInitialized();
      const user = await User.findByPk(sessionData.userId);

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        try {
          await redisClient.client.del(sessionKey);
        } catch (err) {
          console.log('Could not clean up Redis session:', err.message);
        }
        return res.status(400).json({
          success: false,
          error: 'MFA not configured for this user'
        });
      }

      // Handle different MFA methods
      let verified = false;

      if (method === 'backup') {
        // Verify backup code
        if (user.mfaBackupCodes) {
          const backupCodes = JSON.parse(user.mfaBackupCodes);
          const codeIndex = backupCodes.indexOf(code);

          if (codeIndex !== -1) {
            verified = true;
            // Remove used backup code
            backupCodes.splice(codeIndex, 1);
            user.mfaBackupCodes = JSON.stringify(backupCodes);
            await user.save();
            console.log(`[Mobile MFA] Backup code used for user ${user.email}`);
          }
        }
      } else {
        // Default to TOTP verification
        verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: code,
          window: 2 // Allow 2 time windows for clock drift
        });
      }

      if (!verified) {
        return res.status(401).json({
          success: false,
          error: 'Invalid MFA code'
        });
      }

      console.log(`[Mobile MFA] User ${user.email} verified successfully`);

      // MFA verified - Complete the login via session
      // Log the user in using passport
      req.login(user, async function(err) {
        if (err) {
          console.error('[Mobile MFA] Login error:', err);
          return res.status(500).json({
            success: false,
            error: 'Authentication failed'
          });
        }

        // Mark MFA as verified in session
        req.session.mfaVerified = true;
        req.session.loginMethod = 'password';

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Clean up MFA session (don't fail if Redis is down)
        try {
          await redisClient.client.del(sessionKey);
        } catch (err) {
          console.log('Could not clean up Redis session:', err.message);
        }

        // Save session and return success
        req.session.save(function(err) {
          if (err) {
            console.error('[Mobile MFA] Session save error:', err);
            return res.status(500).json({
              success: false,
              error: 'Failed to save session'
            });
          }

          // Return success with user info
          res.json({
            success: true,
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              mfaEnabled: user.mfaEnabled
            }
          });
        });
      });

    } catch (error) {
      console.error('[Mobile MFA] Verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

/**
 * POST /mobile/auth/send-mfa-code - Send MFA code via email for mobile
 */
router.post('/send-mfa-code', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Retrieve session from Redis
    const sessionKey = `mobile_mfa_session:${sessionId}`;
    const sessionDataStr = await redisClient.client.get(sessionKey);

    if (!sessionDataStr) {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.',
        sessionExpired: true
      });
    }

    const sessionData = JSON.parse(sessionDataStr);
    const userId = sessionData.userId;

    const User = await ensureDatabaseInitialized();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({
        success: false,
        error: 'MFA is not properly configured for this user'
      });
    }

    // Rate limiting
    const rateLimitKey = `mfa_rate_limit:${userId}`;
    const lastSent = await redisClient.client.get(rateLimitKey);

    if (lastSent) {
      const timeSinceLastSent = Date.now() - parseInt(lastSent);
      if (timeSinceLastSent < 120000) { // 2 minutes cooldown
        return res.status(429).json({
          success: false,
          error: `Please wait ${Math.ceil((120000 - timeSinceLastSent) / 1000)} seconds before requesting another code.`
        });
      }
    }

    // Generate TOTP code using the user's MFA secret
    const totp = speakeasy.totp({
      secret: user.mfaSecret,
      encoding: 'base32'
    });

    // Send email with the TOTP code
    await sendEmail({
      to: user.email,
      subject: 'Your MFA Verification Code',
      text: `Your verification code is: ${totp}\n\nThis code will expire in 120 seconds (2 minutes).`,
      html: `<p>Your verification code is: <strong>${totp}</strong></p><p>This code will expire in 120 seconds (2 minutes).</p>`
    });

    // Set rate limit
    await redisClient.client.set(rateLimitKey, Date.now().toString(), {
      EX: 300 // 5 minutes expiration
    });

    console.log(`[Mobile MFA] Code sent to user ${userId} (${user.email})`);

    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('[Mobile MFA] Send code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send MFA code'
    });
  }
});

module.exports = router;
