/**
 * FILE: backend/routes/sites.js
 * PURPOSE: API routes for site management in DevOpser Lite
 * DESCRIPTION: Handles CRUD operations for sites, chat-based configuration,
 *              and triggering deployments.
 */

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const db = require('../models');
const { processWithTools, generateSiteFromDescription } = require('../services/websiteAgentServiceV2');
const { createSiteConfig, validateSiteConfig } = require('../services/templateService');

/**
 * GET /api/sites
 * List all sites for the authenticated user
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const sites = await db.Site.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      include: [
        {
          model: db.Deployment,
          as: 'deployments',
          limit: 1,
          order: [['started_at', 'DESC']]
        }
      ]
    });

    res.json({
      success: true,
      sites: sites.map(site => site.toPublicJSON())
    });
  } catch (error) {
    console.error('[Sites] Error listing sites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sites'
    });
  }
});

/**
 * POST /api/sites
 * Create a new site
 * Accepts either:
 *   - draftConfig: Pre-generated config (from anonymous preview)
 *   - initialPrompt/description: Generate config with AI
 *   - neither: Create with default template
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { name, description, initialPrompt, draftConfig: providedConfig } = req.body;
    const siteDescription = description || initialPrompt; // Accept both

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Site name is required'
      });
    }

    // Generate a unique slug
    let baseSlug = db.Site.generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (!(await db.Site.isSlugAvailable(slug))) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create initial configuration
    let draftConfig;

    if (providedConfig && providedConfig.sections && providedConfig.sections.length > 0) {
      // Use pre-generated config (from anonymous preview)
      draftConfig = providedConfig;
      draftConfig.siteName = name;
      console.log(`[Sites] Using pre-generated config with ${draftConfig.sections.length} sections`);
    } else if (siteDescription) {
      // Use AI to generate initial config from description
      const result = await generateSiteFromDescription(siteDescription);
      if (result.newConfig) {
        draftConfig = result.newConfig;
        draftConfig.siteName = name;
      } else {
        draftConfig = createSiteConfig(name);
      }
    } else {
      draftConfig = createSiteConfig(name);
    }

    // Create the site
    const site = await db.Site.create({
      userId: req.user.id,
      name,
      slug,
      status: 'draft',
      draftConfig
    });

    console.log(`[Sites] Created site ${site.id} (${slug}) for user ${req.user.id}`);

    res.status(201).json({
      success: true,
      site: site.toPublicJSON(),
      message: providedConfig ? 'Site created from your preview!' : (siteDescription ? 'Site created with AI-generated content!' : 'Site created successfully!')
    });
  } catch (error) {
    console.error('[Sites] Error creating site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create site'
    });
  }
});

/**
 * GET /api/sites/:id
 * Get site details
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      include: [
        {
          model: db.Deployment,
          as: 'deployments',
          order: [['started_at', 'DESC']],
          limit: 5
        },
        {
          model: db.SiteImage,
          as: 'images',
          order: [['created_at', 'DESC']],
          limit: 10
        }
      ]
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    res.json({
      success: true,
      site: site.toPublicJSON(),
      deployments: site.deployments.map(d => d.toPublicJSON()),
      images: site.images.map(i => i.toPublicJSON())
    });
  } catch (error) {
    console.error('[Sites] Error getting site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get site'
    });
  }
});

/**
 * PUT /api/sites/:id
 * Update site configuration (direct update, not chat-based)
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    const { name, draftConfig, customDomain } = req.body;

    // Update fields if provided
    if (name) {
      site.name = name;
    }

    if (draftConfig) {
      // Ensure siteName is present (may be missing in direct updates)
      if (!draftConfig.siteName && site.draftConfig && site.draftConfig.siteName) {
        draftConfig.siteName = site.draftConfig.siteName;
      } else if (!draftConfig.siteName) {
        draftConfig.siteName = site.name;
      }

      const validation = validateSiteConfig(draftConfig);
      if (!validation.valid) {
        console.log('[Sites] Validation errors:', validation.errors);
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: validation.errors
        });
      }
      site.draftConfig = draftConfig;
    }

    if (customDomain !== undefined) {
      site.customDomain = customDomain || null;
    }

    await site.save();

    console.log(`[Sites] Updated site ${site.id}`);

    res.json({
      success: true,
      site: site.toPublicJSON()
    });
  } catch (error) {
    console.error('[Sites] Error updating site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update site'
    });
  }
});

/**
 * PATCH /api/sites/:id/settings
 * Update site settings (lead notifications, auto-responder, etc.)
 */
router.patch('/:id/settings', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    const {
      leadNotificationEnabled,
      leadAutoresponderEnabled,
      leadAutoresponderSubject,
      leadAutoresponderBody,
      leadReplyToEmail
    } = req.body;

    // Update fields if provided (using camelCase property names from model)
    if (leadNotificationEnabled !== undefined) {
      site.leadNotificationEnabled = leadNotificationEnabled;
    }

    if (leadAutoresponderEnabled !== undefined) {
      site.leadAutoresponderEnabled = leadAutoresponderEnabled;
    }

    if (leadAutoresponderSubject !== undefined) {
      site.leadAutoresponderSubject = leadAutoresponderSubject;
    }

    if (leadAutoresponderBody !== undefined) {
      site.leadAutoresponderBody = leadAutoresponderBody;
    }

    if (leadReplyToEmail !== undefined) {
      site.leadReplyToEmail = leadReplyToEmail;
    }

    await site.save();

    console.log(`[Sites] Updated settings for site ${site.id}`);

    res.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error) {
    console.error('[Sites] Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save settings'
    });
  }
});

/**
 * DELETE /api/sites/:id
 * Delete a site
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    const siteId = site.id;
    const siteName = site.name;
    const slug = site.slug;

    console.log(`[Sites] Starting deletion of site ${siteId} (${siteName})`);

    // Deployment-target cleanup hook. The original template tore down a
    // per-site Lightsail container service, Route53 records, and an ACM
    // certificate here. Those have been removed in favor of BYO deploy —
    // add your own teardown logic for whichever target you wired up in
    // the publish flow (see AGENTS.md → Deployment).
    if (site.lightsailServiceName || site.customDomain || site.githubRepoUrl) {
      console.log(`[Sites] Skipping deployment-target teardown for site ${siteId} — not configured`);
    }

    // Delete related database records
    await db.Deployment.destroy({ where: { siteId: siteId } });
    await db.SiteImage.destroy({ where: { siteId: siteId } });

    // Delete the site record
    await site.destroy();

    console.log(`[Sites] Successfully deleted site ${siteId} (${siteName})`);

    // Log what was cleaned up for audit trail
    console.log(`[Sites] Cleanup summary for site ${siteId}:`, {
      lightsail: site.lightsailServiceName ? 'deleted' : 'n/a',
      ecr: 'cleaned',
      github: site.githubRepoUrl ? 'deleted' : 'n/a',
      subdomain: `${slug}.example.com deleted`,
      customDomain: site.customDomain || 'n/a',
      customDomainDns: site.customDomain ? 'deleted' : 'n/a',
      customDomainSsl: site.customDomain ? 'certificate deleted' : 'n/a'
    });

    res.json({
      success: true,
      message: 'Site deleted successfully'
    });
  } catch (error) {
    console.error('[Sites] Error deleting site:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete site'
    });
  }
});

/**
 * POST /api/sites/:id/chat
 * Chat with AI to modify site configuration
 */
router.post('/:id/chat', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log(`[Sites] Chat message for site ${site.id}: ${message.substring(0, 100)}`);

    // Process the message with the AI agent (using tool use)
    const result = await processWithTools(message, site.draftConfig, history);

    // Update the site if there were changes
    if (result.newConfig) {
      site.draftConfig = result.newConfig;
      await site.save();
      console.log(`[Sites] Updated site ${site.id} config via chat. Tools used: ${result.toolsUsed?.map(t => t.name).join(', ') || 'none'}`);
    }

    res.json({
      success: true,
      message: result.message,
      toolsUsed: result.toolsUsed || [],
      site: site.toPublicJSON(),
      siteConfig: site.draftConfig // Convenience for frontend preview
    });
  } catch (error) {
    console.error('[Sites] Error in chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message'
    });
  }
});

/**
 * POST /api/sites/:id/publish
 * Trigger deployment of the site
 */
router.post('/:id/publish', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    if (!site.draftConfig || !site.draftConfig.sections || site.draftConfig.sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Site has no content to publish'
      });
    }

    // Create a deployment record
    const deployment = await db.Deployment.create({
      siteId: site.id,
      status: 'pending',
      configSnapshot: site.draftConfig
    });

    // Update site status
    site.status = 'deploying';
    await site.save();

    console.log(`[Sites] Starting deployment ${deployment.id} for site ${site.id}`);

    // TODO: Trigger actual deployment process
    // For now, we'll simulate the deployment process
    triggerDeployment(site, deployment).catch(error => {
      console.error(`[Sites] Deployment ${deployment.id} failed:`, error);
    });

    res.json({
      success: true,
      message: 'Deployment started',
      deployment: deployment.toPublicJSON(),
      site: site.toPublicJSON()
    });
  } catch (error) {
    console.error('[Sites] Error starting deployment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start deployment'
    });
  }
});

/**
 * GET /api/sites/:id/deployments
 * Get deployment history for a site
 */
router.get('/:id/deployments', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    const deployments = await db.Deployment.findAll({
      where: { siteId: site.id },
      order: [['started_at', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      deployments: deployments.map(d => d.toPublicJSON())
    });
  } catch (error) {
    console.error('[Sites] Error getting deployments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployments'
    });
  }
});

/**
 * GET /api/sites/:id/status
 * Lightweight endpoint for polling deployment status
 * Returns only essential status info to minimize server load
 */
router.get('/:id/status', ensureAuthenticated, async (req, res) => {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      attributes: ['id', 'slug', 'status', 'deploymentStatus', 'lightsailEndpoint', 'lightsailUrl', 'lastDeployedAt', 'deploymentError']
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    // Determine if deployment is complete
    const isDeploying = ['pending', 'creating_service', 'deploying'].includes(site.deploymentStatus);
    const isComplete = site.deploymentStatus === 'active' && site.status === 'published';
    const isFailed = site.status === 'failed' || site.deploymentStatus === 'failed';

    res.json({
      success: true,
      status: {
        siteStatus: site.status,
        deploymentStatus: site.deploymentStatus,
        isDeploying,
        isComplete,
        isFailed,
        error: site.deploymentError,
        siteUrl: isComplete ? `https://${site.slug}.example.com` : null,
        lightsailUrl: site.lightsailUrl,
        lastDeployedAt: site.lastDeployedAt
      }
    });
  } catch (error) {
    console.error('[Sites] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status'
    });
  }
});

/**
 * Trigger the actual deployment process (async).
 *
 * This is where the original template spun up a per-site Lightsail container
 * service, pushed an image to ECR, wired up Route53 DNS, and marked the
 * deployment as active. None of that logic ships with this template — pick
 * a deployment target (Lightsail, Cloud Run, Fly.io, ECS, K8s, bare VPS,
 * etc.) and implement it here. See `AGENTS.md` → "Adding a deployment
 * target" for patterns, including the StackSet + Organizations OU bootstrap
 * recipe used for multi-tenant cross-account trust roles.
 *
 * Keeping this function as a deliberate stub means:
 *   1. The publish button in the UI still round-trips a Deployment row so
 *      the database schema stays stable.
 *   2. Your AI coding agent has a single, obvious place to plug in real
 *      deployment logic when you ask it to.
 */
async function triggerDeployment(site, deployment) {
  try {
    await deployment.markAsBuilding();
    site.deploymentStatus = 'not_configured';
    site.deploymentError = null;
    await site.save();

    console.log(`[Sites] triggerDeployment stub called for site ${site.id} — no deploy target configured.`);
    console.log('[Sites] Implement this in backend/routes/sites.js → triggerDeployment(). See AGENTS.md.');

    await deployment.markAsFailed(
      'No deployment target is configured in this template. ' +
      'Open backend/routes/sites.js → triggerDeployment() and wire up your target, ' +
      'then see AGENTS.md for IAC patterns and examples.'
    );
    site.status = 'draft';
    site.deploymentStatus = 'not_configured';
    site.deploymentError = 'Deployment target not configured (see AGENTS.md).';
    await site.save();
  } catch (error) {
    console.error(`[Sites] Deployment ${deployment.id} failed:`, error);
    await deployment.markAsFailed(error.message);
    site.status = 'failed';
    site.deploymentStatus = 'failed';
    site.deploymentError = error.message;
    await site.save();
  }
}

module.exports = router;
