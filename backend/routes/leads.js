/**
 * Leads Routes
 * Handles lead capture from deployed customer sites and lead management
 */
const express = require('express');
const router = express.Router();
const db = require('../models');
const { sendEmail } = require('../services/emailService');

/**
 * Send auto-responder email to the lead (person who submitted the form)
 * Uses the site's customizable auto-responder settings
 */
async function sendAutoResponder(site, formData) {
  try {
    // Check if auto-responder is enabled
    if (!site.lead_autoresponder_enabled) {
      console.log(`[Leads] Auto-responder disabled for site ${site.id}`);
      return;
    }

    // Get the submitter's email from form data
    const submitterEmail = formData.email || formData.Email || formData.EMAIL;
    if (!submitterEmail) {
      console.log(`[Leads] No email in form data, skipping auto-responder`);
      return;
    }

    // Get the submitter's name (optional)
    const submitterName = formData.name || formData.Name || formData.NAME ||
                         formData.firstName || formData.first_name || 'there';

    // Build the email content with placeholder replacement
    let subject = site.lead_autoresponder_subject || 'Thank you for contacting us!';
    let body = site.lead_autoresponder_body;

    // If no custom body, use default
    if (!body) {
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank you for reaching out!</h2>
          <p>Hi {{name}},</p>
          <p>We've received your message and will get back to you as soon as possible.</p>
          <p>Best regards,<br>${site.name}</p>
        </div>
      `;
    }

    // Replace placeholders
    subject = subject.replace(/\{\{name\}\}/gi, submitterName)
                     .replace(/\{\{email\}\}/gi, submitterEmail)
                     .replace(/\{\{site_name\}\}/gi, site.name);

    body = body.replace(/\{\{name\}\}/gi, submitterName)
               .replace(/\{\{email\}\}/gi, submitterEmail)
               .replace(/\{\{site_name\}\}/gi, site.name);

    // Replace any form field placeholders like {{phone}}, {{message}}, etc.
    for (const [key, value] of Object.entries(formData)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      subject = subject.replace(placeholder, value || '');
      body = body.replace(placeholder, value || '');
    }

    // Send the email
    const emailOptions = {
      to: submitterEmail,
      subject,
      html: body
    };

    // Add reply-to if configured
    if (site.lead_reply_to_email) {
      emailOptions.replyTo = site.lead_reply_to_email;
    }

    await sendEmail(emailOptions);
    console.log(`[Leads] Auto-responder sent to ${submitterEmail} for site ${site.id}`);

  } catch (error) {
    console.error(`[Leads] Failed to send auto-responder:`, error.message);
  }
}

/**
 * Send notification email to site owner when a new lead is captured
 * Runs asynchronously - doesn't block the response
 */
async function notifySiteOwner(site, lead, formData) {
  try {
    // Check if notifications are enabled (default to true for backwards compatibility)
    if (site.lead_notification_enabled === false) {
      console.log(`[Leads] Owner notifications disabled for site ${site.id}`);
      return;
    }

    // Get the site owner
    const owner = await db.User.findByPk(site.user_id);
    if (!owner || !owner.email) {
      console.log(`[Leads] No owner email found for site ${site.id}`);
      return;
    }

    // Format the form data for the email
    const formFields = Object.entries(formData)
      .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
      .join('<br>');

    // Build email content
    const subject = `New Lead from ${site.name}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">New Lead Captured!</h2>
        <p>You have a new lead from your website <strong>${site.name}</strong>.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Contact Details</h3>
          ${formFields}
        </div>

        <p style="color: #666; font-size: 14px;">
          Submitted: ${new Date(lead.submitted_at).toLocaleString()}<br>
          Source: ${lead.source || 'Contact Form'}
        </p>

        <p style="margin-top: 30px;">
          <a href="${process.env.BASE_URL || 'https://example.com'}/sites/${site.id}/builder"
             style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View All Leads
          </a>
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This notification was sent by DevOpser Lite.
          Manage your notification preferences in your account settings.
        </p>
      </div>
    `;

    await sendEmail({
      to: owner.email,
      subject,
      html: htmlContent
    });

    console.log(`[Leads] Notification sent to ${owner.email} for lead ${lead.id}`);

  } catch (error) {
    // Don't throw - email notification is non-critical
    console.error(`[Leads] Failed to send notification email:`, error.message);
  }
}

/**
 * POST /api/leads
 * Public endpoint for capturing leads from deployed sites
 * No authentication required - sites submit directly
 */
router.post('/', async (req, res) => {
  try {
    const { siteId, formData, source, timestamp } = req.body;

    // Validate required fields
    if (!siteId || !formData) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'siteId and formData are required'
      });
    }

    // Verify the site exists
    const site = await db.Site.findByPk(siteId);
    if (!site) {
      return res.status(404).json({
        error: 'Site not found',
        details: 'The specified site does not exist'
      });
    }

    // Capture metadata from request
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;
    const referrer = req.headers['referer'] || req.headers['referrer'] || null;

    // Create the lead
    const lead = await db.Lead.create({
      site_id: siteId,
      form_data: formData,
      source: source || 'contactForm',
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: referrer,
      submitted_at: timestamp ? new Date(timestamp) : new Date(),
      status: 'new'
    });

    console.log(`[Leads] New lead captured for site ${siteId}: ${lead.id}`);

    // Send emails asynchronously - don't block response
    // 1. Notify site owner
    notifySiteOwner(site, lead, formData).catch(err => {
      console.error(`[Leads] Owner notification error:`, err.message);
    });

    // 2. Send auto-responder to the person who submitted the form
    sendAutoResponder(site, formData).catch(err => {
      console.error(`[Leads] Auto-responder error:`, err.message);
    });

    // Return success (keep response minimal for cross-origin requests)
    res.status(201).json({
      success: true,
      leadId: lead.id
    });

  } catch (error) {
    console.error('[Leads] Error capturing lead:', error);
    res.status(500).json({
      error: 'Failed to capture lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Middleware to check authentication for protected routes
 * Supports both session auth and API key auth
 */
async function requireAuth(req, res, next) {
  // Check for API key in header (Authorization: Bearer dol_xxx)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer dol_')) {
    const apiKey = authHeader.slice(7); // Remove 'Bearer '

    try {
      const apiKeyRecord = await db.ApiKey.verifyKey(apiKey);
      if (apiKeyRecord) {
        // Load the user
        const user = await db.User.findByPk(apiKeyRecord.user_id);
        if (user) {
          // Attach to request for use in route handlers
          req.apiKey = apiKeyRecord;
          req.apiKeyUser = user;
          req.session = req.session || {};
          req.session.user = { id: user.id };
          return next();
        }
      }
    } catch (error) {
      console.error('[Leads] API key verification error:', error);
    }

    return res.status(401).json({ error: 'Invalid or expired API key' });
  }

  // Fall back to session auth (check both Passport's req.user and session.user)
  if (req.user) {
    // Passport authentication - normalize to session.user format
    req.session = req.session || {};
    req.session.user = { id: req.user.id };
    return next();
  }

  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to check API key scope
 */
function requireScope(scope) {
  return (req, res, next) => {
    // If using API key, check scope
    if (req.apiKey) {
      if (!req.apiKey.hasScope(scope)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: scope,
          granted: req.apiKey.scopes
        });
      }
    }
    next();
  };
}

/**
 * GET /api/leads/site/:siteId
 * Get all leads for a specific site (authenticated)
 * Requires leads:read scope for API key access
 */
router.get('/site/:siteId', requireAuth, requireScope('leads:read'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.user.id;

    // Verify user owns the site
    const site = await db.Site.findOne({
      where: { id: siteId, user_id: userId }
    });

    if (!site) {
      return res.status(404).json({
        error: 'Site not found',
        details: 'Site does not exist or you do not have access'
      });
    }

    // Get query parameters for filtering/pagination
    const { status, limit = 50, offset = 0 } = req.query;

    const whereClause = { site_id: siteId };
    if (status) {
      whereClause.status = status;
    }

    const leads = await db.Lead.findAndCountAll({
      where: whereClause,
      order: [['submitted_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      leads: leads.rows,
      total: leads.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[Leads] Error fetching leads:', error);
    res.status(500).json({
      error: 'Failed to fetch leads',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/leads/:leadId
 * Get a specific lead (authenticated)
 */
router.get('/:leadId', requireAuth, requireScope('leads:read'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.session.user.id;

    const lead = await db.Lead.findByPk(leadId, {
      include: [{
        model: db.Site,
        as: 'site',
        attributes: ['id', 'name', 'user_id']
      }]
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Verify user owns the site
    if (lead.site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(lead);

  } catch (error) {
    console.error('[Leads] Error fetching lead:', error);
    res.status(500).json({
      error: 'Failed to fetch lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/leads/:leadId
 * Update lead status or notes (authenticated)
 */
router.patch('/:leadId', requireAuth, requireScope('leads:write'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.session.user.id;
    const { status, notes } = req.body;

    const lead = await db.Lead.findByPk(leadId, {
      include: [{
        model: db.Site,
        as: 'site',
        attributes: ['id', 'user_id']
      }]
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Verify user owns the site
    if (lead.site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update allowed fields
    if (status) {
      const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          details: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
      lead.status = status;
    }

    if (notes !== undefined) {
      lead.notes = notes;
    }

    await lead.save();

    res.json(lead);

  } catch (error) {
    console.error('[Leads] Error updating lead:', error);
    res.status(500).json({
      error: 'Failed to update lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/leads/:leadId
 * Delete a lead (authenticated)
 */
router.delete('/:leadId', requireAuth, requireScope('leads:write'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.session.user.id;

    const lead = await db.Lead.findByPk(leadId, {
      include: [{
        model: db.Site,
        as: 'site',
        attributes: ['id', 'user_id']
      }]
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Verify user owns the site
    if (lead.site.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await lead.destroy();

    res.json({ success: true, message: 'Lead deleted' });

  } catch (error) {
    console.error('[Leads] Error deleting lead:', error);
    res.status(500).json({
      error: 'Failed to delete lead',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/leads/stats/:siteId
 * Get lead statistics for a site (authenticated)
 */
router.get('/stats/:siteId', requireAuth, requireScope('leads:read'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.user.id;

    // Verify user owns the site
    const site = await db.Site.findOne({
      where: { id: siteId, user_id: userId }
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Get counts by status
    const statusCounts = await db.Lead.findAll({
      where: { site_id: siteId },
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Get total count
    const total = await db.Lead.count({ where: { site_id: siteId } });

    // Get recent leads count (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = await db.Lead.count({
      where: {
        site_id: siteId,
        submitted_at: { [db.sequelize.Sequelize.Op.gte]: weekAgo }
      }
    });

    res.json({
      total,
      recentCount,
      byStatus: statusCounts.reduce((acc, item) => {
        acc[item.status] = parseInt(item.dataValues.count);
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('[Leads] Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch lead statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
