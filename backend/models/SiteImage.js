/**
 * FILE: backend/models/SiteImage.js
 * PURPOSE: SiteImage model for DevOpser Lite
 * DESCRIPTION: Tracks AI-generated images for sites including prompts,
 *              S3 storage keys, and CloudFront URLs.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SiteImage = sequelize.define('SiteImage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    siteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'site_id',
      references: {
        model: 'sites',
        key: 'id'
      }
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    s3Key: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 's3_key'
    },
    cloudfrontUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'cloudfront_url'
    }
  }, {
    tableName: 'site_images',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  // Instance methods
  SiteImage.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      siteId: this.siteId,
      prompt: this.prompt,
      url: this.cloudfrontUrl || `https://your-cloudfront.cloudfront.net/${this.s3Key}`,
      createdAt: this.created_at
    };
  };

  // Associations
  SiteImage.associate = (models) => {
    SiteImage.belongsTo(models.Site, {
      foreignKey: 'site_id',
      as: 'site'
    });
  };

  return SiteImage;
};
