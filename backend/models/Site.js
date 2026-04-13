/**
 * FILE: backend/models/Site.js
 * PURPOSE: Site model for DevOpser Lite website builder
 * DESCRIPTION: Represents a customer's website with draft/published config,
 *              GitHub repo reference, Lightsail deployment info, and custom domain.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Site = sequelize.define('Site', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-z0-9-]+$/i,  // Only alphanumeric and hyphens
        len: [3, 100]
      }
    },
    githubRepoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'github_repo_url'
    },
    lightsailServiceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'lightsail_service_name'
    },
    lightsailEndpoint: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'lightsail_endpoint'
    },
    lightsailUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'lightsail_url'
    },
    status: {
      type: DataTypes.ENUM('draft', 'deploying', 'published', 'failed'),
      defaultValue: 'draft'
    },
    deploymentStatus: {
      type: DataTypes.ENUM('none', 'pending', 'creating_service', 'deploying', 'active', 'failed'),
      allowNull: false,
      defaultValue: 'none',
      field: 'deployment_status'
    },
    lastDeployedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_deployed_at'
    },
    deploymentError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'deployment_error'
    },
    draftConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'draft_config',
      defaultValue: {
        siteName: '',
        theme: {
          primaryColor: '#3B82F6',
          secondaryColor: '#10B981',
          fontFamily: 'Inter'
        },
        sections: []
      }
    },
    publishedConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'published_config'
    },
    customDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'custom_domain',
      validate: {
        is: /^[a-z0-9.-]+$/i  // Basic domain validation
      }
    },
    // Lead notification settings
    leadNotificationEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'lead_notification_enabled'
    },
    leadReplyToEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'lead_reply_to_email'
    },
    // Lead auto-responder settings
    leadAutoresponderEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'lead_autoresponder_enabled'
    },
    leadAutoresponderSubject: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'Thank you for contacting us!',
      field: 'lead_autoresponder_subject'
    },
    leadAutoresponderBody: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'lead_autoresponder_body'
    }
  }, {
    tableName: 'sites',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Instance methods
  Site.prototype.getPublicUrl = function() {
    if (this.customDomain) {
      return `https://${this.customDomain}`;
    }
    const domain = process.env.DOMAIN;
    return domain ? `https://${this.slug}.${domain}` : null;
  };

  Site.prototype.getPreviewUrl = function() {
    if (this.lightsailEndpoint) {
      return this.lightsailEndpoint;
    }
    return null;
  };

  Site.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      status: this.status,
      publicUrl: this.getPublicUrl(),
      previewUrl: this.getPreviewUrl(),
      customDomain: this.customDomain,
      draftConfig: this.draftConfig,
      publishedConfig: this.publishedConfig,
      deploymentStatus: this.deploymentStatus,
      lightsailUrl: this.lightsailUrl,
      lightsailEndpoint: this.lightsailEndpoint,
      lastDeployedAt: this.lastDeployedAt,
      deploymentError: this.deploymentError,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  };

  // Class methods
  Site.generateSlug = function(name) {
    // Generate a random suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const baseName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);  // Shorter to allow room for suffix
    return `${baseName}-${randomSuffix}`;
  };

  Site.isSlugAvailable = async function(slug) {
    const existing = await Site.findOne({ where: { slug } });
    return !existing;
  };

  // Associations
  Site.associate = (models) => {
    Site.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'owner'
    });

    Site.hasMany(models.Deployment, {
      foreignKey: 'site_id',
      as: 'deployments'
    });

    Site.hasMany(models.SiteImage, {
      foreignKey: 'site_id',
      as: 'images'
    });
  };

  return Site;
};
