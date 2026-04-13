/**
 * Lead Model
 * Stores leads captured from customer sites via form submissions
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Lead = sequelize.define('Lead', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    site_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sites',
        key: 'id'
      }
    },
    form_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Section ID or form identifier where lead was captured'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address of the visitor (for analytics)'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Browser user agent string'
    },
    referrer: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Referrer URL'
    },
    status: {
      type: DataTypes.ENUM('new', 'contacted', 'qualified', 'converted', 'archived'),
      defaultValue: 'new',
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Internal notes about this lead'
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Leads',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['site_id'] },
      { fields: ['status'] },
      { fields: ['submitted_at'] },
      { fields: ['site_id', 'status'] }
    ]
  });

  return Lead;
};
