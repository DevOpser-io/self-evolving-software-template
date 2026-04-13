/**
 * FILE: backend/services/s3Service.js
 * PURPOSE: S3 image upload and management service
 * DESCRIPTION: Handles image uploads to S3 with CloudFront CDN distribution.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

// Configuration from environment variables
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_REGION = process.env.AWS_S3_REGION || process.env.REGION || 'us-east-1';
// CLOUDFRONT_DISTRIBUTION_URL is a full URL like https://xxx.cloudfront.net
const CLOUDFRONT_URL = process.env.CLOUDFRONT_DISTRIBUTION_URL;
// Extract just the domain from the URL for comparison
const CLOUDFRONT_DOMAIN = CLOUDFRONT_URL ? new URL(CLOUDFRONT_URL).host : null;

// Validate required configuration
if (!S3_BUCKET) {
  console.error('[S3] ERROR: S3_BUCKET_NAME environment variable is required');
} else {
  console.log(`[S3] Configured with bucket: ${S3_BUCKET}, region: ${S3_REGION}`);
  if (CLOUDFRONT_URL) {
    console.log(`[S3] CloudFront CDN enabled: ${CLOUDFRONT_DOMAIN}`);
  }
}

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_REGION
});

// Allowed image types and their MIME types
const ALLOWED_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate a unique filename for upload
 * @param {string} originalName - Original filename
 * @param {number} siteId - Site ID
 * @returns {string} - Unique key for S3
 */
function generateS3Key(originalName, siteId) {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  return `sites/${siteId}/images/${timestamp}-${hash}${ext}`;
}

/**
 * Validate file type and size
 * @param {string} filename - Original filename
 * @param {number} size - File size in bytes
 * @returns {Object} - { valid: boolean, error?: string, mimeType?: string }
 */
function validateFile(filename, size) {
  const ext = path.extname(filename).toLowerCase();

  if (!ALLOWED_TYPES[ext]) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
    };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  return {
    valid: true,
    mimeType: ALLOWED_TYPES[ext]
  };
}

/**
 * Get the public URL for an S3 object
 * @param {string} key - S3 object key
 * @returns {string} - Public URL (CloudFront if configured, otherwise S3)
 */
function getPublicUrl(key) {
  if (CLOUDFRONT_URL) {
    // CLOUDFRONT_URL is like https://xxx.cloudfront.net - append the key
    const baseUrl = CLOUDFRONT_URL.endsWith('/') ? CLOUDFRONT_URL.slice(0, -1) : CLOUDFRONT_URL;
    return `${baseUrl}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

/**
 * Upload an image to S3
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} originalName - Original filename
 * @param {number} siteId - Site ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - { success: boolean, key?: string, url?: string, error?: string }
 */
async function uploadImage(fileBuffer, originalName, siteId, options = {}) {
  try {
    // Validate file
    const validation = validateFile(originalName, fileBuffer.length);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate unique key
    const key = generateS3Key(originalName, siteId);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: validation.mimeType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        'site-id': String(siteId),
        'original-name': originalName,
        ...(options.metadata || {})
      }
    });

    await s3Client.send(command);

    console.log(`[S3] Uploaded image: ${key}`);

    return {
      success: true,
      key,
      url: getPublicUrl(key),
      mimeType: validation.mimeType,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('[S3] Upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload image'
    };
  }
}

/**
 * Delete an image from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
async function deleteImage(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    });

    await s3Client.send(command);

    console.log(`[S3] Deleted image: ${key}`);

    return { success: true };
  } catch (error) {
    console.error('[S3] Delete error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete image'
    };
  }
}

/**
 * Generate a presigned URL for direct upload from browser
 * @param {string} filename - Desired filename
 * @param {string} contentType - MIME type
 * @param {number} siteId - Site ID
 * @param {number} expiresIn - URL expiration in seconds (default: 5 minutes)
 * @returns {Promise<Object>} - { success: boolean, uploadUrl?: string, key?: string, publicUrl?: string, error?: string }
 */
async function getSignedUploadUrl(filename, contentType, siteId, expiresIn = 300) {
  try {
    // Validate file type
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_TYPES[ext]) {
      return {
        success: false,
        error: `File type not allowed. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`
      };
    }

    // Generate key
    const key = generateS3Key(filename, siteId);

    // Create presigned URL
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        'site-id': String(siteId),
        'original-name': filename
      }
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      success: true,
      uploadUrl,
      key,
      publicUrl: getPublicUrl(key)
    };
  } catch (error) {
    console.error('[S3] Presigned URL error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate upload URL'
    };
  }
}

/**
 * Check if an S3 key exists
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
async function objectExists(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

/**
 * Extract S3 key from a public URL
 * @param {string} url - Public URL (CloudFront or S3)
 * @returns {string|null} - S3 key or null if not a valid URL
 */
function extractKeyFromUrl(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // CloudFront URL
    if (CLOUDFRONT_DOMAIN && urlObj.host === CLOUDFRONT_DOMAIN) {
      return urlObj.pathname.slice(1); // Remove leading slash
    }

    // S3 URL
    if (urlObj.host.includes(S3_BUCKET)) {
      return urlObj.pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = {
  uploadImage,
  deleteImage,
  getSignedUploadUrl,
  getPublicUrl,
  validateFile,
  objectExists,
  extractKeyFromUrl,
  ALLOWED_TYPES,
  MAX_FILE_SIZE
};
