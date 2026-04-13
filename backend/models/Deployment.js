/**
 * FILE: backend/models/Deployment.js
 * PURPOSE: Deployment model for DevOpser Lite
 * DESCRIPTION: Tracks deployment history for sites including status,
 *              config snapshot, Lightsail deployment ID, and error messages.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Deployment = sequelize.define('Deployment', {
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
    status: {
      type: DataTypes.ENUM('pending', 'building', 'deploying', 'success', 'failed'),
      defaultValue: 'pending'
    },
    configSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'config_snapshot'
    },
    lightsailDeploymentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'lightsail_deployment_id'
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message'
    },
    startedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'started_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  }, {
    tableName: 'deployments',
    timestamps: false,
    underscored: true
  });

  // Instance methods
  Deployment.prototype.markAsBuilding = async function() {
    this.status = 'building';
    await this.save();
  };

  Deployment.prototype.markAsDeploying = async function() {
    this.status = 'deploying';
    await this.save();
  };

  Deployment.prototype.markAsSuccess = async function(lightsailDeploymentId) {
    this.status = 'success';
    this.lightsailDeploymentId = lightsailDeploymentId;
    this.completedAt = new Date();
    await this.save();
  };

  Deployment.prototype.markAsFailed = async function(errorMessage) {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.completedAt = new Date();
    await this.save();
  };

  Deployment.prototype.getDuration = function() {
    if (!this.completedAt) {
      return null;
    }
    return Math.round((this.completedAt - this.startedAt) / 1000);
  };

  Deployment.prototype.toPublicJSON = function() {
    return {
      id: this.id,
      siteId: this.siteId,
      status: this.status,
      lightsailDeploymentId: this.lightsailDeploymentId,
      errorMessage: this.errorMessage,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationSeconds: this.getDuration()
    };
  };

  // Associations
  Deployment.associate = (models) => {
    Deployment.belongsTo(models.Site, {
      foreignKey: 'site_id',
      as: 'site'
    });
  };

  return Deployment;
};
