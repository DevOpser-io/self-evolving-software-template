/**
 * FILE: backend/routes/images.js
 * PURPOSE: API routes for image management in DevOpser Lite
 * DESCRIPTION: Handles image uploads, listing, and deletion for sites.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const db = require('../models');
const s3Service = require('../services/s3Service');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: s3Service.MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const validation = s3Service.validateFile(file.originalname, 0);
    if (validation.valid) {
      cb(null, true);
    } else {
      cb(new Error(validation.error));
    }
  }
});

/**
 * Middleware to verify site ownership
 */
async function verifySiteOwnership(req, res, next) {
  try {
    const site = await db.Site.findOne({
      where: {
        id: req.params.siteId,
        userId: req.user.id
      }
    });

    if (!site) {
      return res.status(404).json({
        success: false,
        error: 'Site not found'
      });
    }

    req.site = site;
    next();
  } catch (error) {
    console.error('[Images] Error verifying site ownership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify site ownership'
    });
  }
}

/**
 * GET /api/sites/:siteId/images
 * List all images for a site
 */
router.get('/:siteId/images', ensureAuthenticated, verifySiteOwnership, async (req, res) => {
  try {
    const images = await db.SiteImage.findAll({
      where: { siteId: req.params.siteId },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      images: images.map(img => img.toPublicJSON())
    });
  } catch (error) {
    console.error('[Images] Error listing images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list images'
    });
  }
});

/**
 * POST /api/sites/:siteId/images/upload
 * Upload an image file directly
 */
router.post('/:siteId/images/upload', ensureAuthenticated, verifySiteOwnership, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // Upload to S3
    const uploadResult = await s3Service.uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.params.siteId,
      {
        metadata: {
          'uploaded-by': String(req.user.id)
        }
      }
    );

    if (!uploadResult.success) {
      return res.status(400).json({
        success: false,
        error: uploadResult.error
      });
    }

    // Create database record
    const siteImage = await db.SiteImage.create({
      siteId: req.params.siteId,
      s3Key: uploadResult.key,
      cloudfrontUrl: uploadResult.url,
      prompt: req.body.prompt || null
    });

    console.log(`[Images] Uploaded image ${siteImage.id} for site ${req.params.siteId}`);

    res.status(201).json({
      success: true,
      image: siteImage.toPublicJSON()
    });
  } catch (error) {
    console.error('[Images] Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload image'
    });
  }
});

/**
 * POST /api/sites/:siteId/images/signed-url
 * Get a presigned URL for direct browser upload
 */
router.post('/:siteId/images/signed-url', ensureAuthenticated, verifySiteOwnership, async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    const result = await s3Service.getSignedUploadUrl(
      filename,
      contentType || 'image/jpeg',
      req.params.siteId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      key: result.key,
      publicUrl: result.publicUrl
    });
  } catch (error) {
    console.error('[Images] Signed URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL'
    });
  }
});

/**
 * POST /api/sites/:siteId/images/confirm-upload
 * Confirm a presigned URL upload and create database record
 */
router.post('/:siteId/images/confirm-upload', ensureAuthenticated, verifySiteOwnership, async (req, res) => {
  try {
    const { key, publicUrl, prompt } = req.body;

    if (!key || !publicUrl) {
      return res.status(400).json({
        success: false,
        error: 'Key and publicUrl are required'
      });
    }

    // Verify the key belongs to this site
    if (!key.startsWith(`sites/${req.params.siteId}/`)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key for this site'
      });
    }

    // Create database record
    const siteImage = await db.SiteImage.create({
      siteId: req.params.siteId,
      s3Key: key,
      cloudfrontUrl: publicUrl,
      prompt: prompt || null
    });

    console.log(`[Images] Confirmed upload ${siteImage.id} for site ${req.params.siteId}`);

    res.status(201).json({
      success: true,
      image: siteImage.toPublicJSON()
    });
  } catch (error) {
    console.error('[Images] Confirm upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm upload'
    });
  }
});

/**
 * DELETE /api/sites/:siteId/images/:imageId
 * Delete an image
 */
router.delete('/:siteId/images/:imageId', ensureAuthenticated, verifySiteOwnership, async (req, res) => {
  try {
    const image = await db.SiteImage.findOne({
      where: {
        id: req.params.imageId,
        siteId: req.params.siteId
      }
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Delete from S3
    if (image.s3Key) {
      const deleteResult = await s3Service.deleteImage(image.s3Key);
      if (!deleteResult.success) {
        console.warn(`[Images] Failed to delete from S3: ${deleteResult.error}`);
        // Continue with database deletion even if S3 fails
      }
    }

    // Delete database record
    await image.destroy();

    console.log(`[Images] Deleted image ${req.params.imageId} from site ${req.params.siteId}`);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('[Images] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
});

/**
 * GET /api/sites/:siteId/images/:imageId
 * Get a specific image
 */
router.get('/:siteId/images/:imageId', ensureAuthenticated, verifySiteOwnership, async (req, res) => {
  try {
    const image = await db.SiteImage.findOne({
      where: {
        id: req.params.imageId,
        siteId: req.params.siteId
      }
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    res.json({
      success: true,
      image: image.toPublicJSON()
    });
  } catch (error) {
    console.error('[Images] Get image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get image'
    });
  }
});

module.exports = router;
