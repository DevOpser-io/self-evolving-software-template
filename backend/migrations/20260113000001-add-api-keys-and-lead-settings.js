'use strict';

/**
 * Migration: Add API keys table and lead auto-responder settings
 *
 * This migration is IDEMPOTENT - safe to run multiple times.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existingTables = await queryInterface.showAllTables();
    console.log('Existing tables:', existingTables);

    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        return columnName in tableDescription;
      } catch (error) {
        return false;
      }
    };

    // Helper function to safely add column
    const safeAddColumn = async (tableName, columnName, columnDef) => {
      if (await columnExists(tableName, columnName)) {
        console.log(`Column ${tableName}.${columnName} already exists, skipping`);
        return;
      }
      console.log(`Adding column ${tableName}.${columnName}...`);
      await queryInterface.addColumn(tableName, columnName, columnDef);
      console.log(`Added column ${tableName}.${columnName}`);
    };

    // Helper function to safely add index
    const safeAddIndex = async (tableName, columns, options = {}) => {
      try {
        await queryInterface.addIndex(tableName, columns, options);
        console.log(`Created index on ${tableName}(${columns.join(', ')})`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`Index on ${tableName}(${columns.join(', ')}) already exists, skipping`);
        } else {
          throw error;
        }
      }
    };

    // =============================================
    // CREATE API_KEYS TABLE
    // =============================================
    if (!existingTables.includes('api_keys')) {
      console.log('Creating api_keys table...');

      await queryInterface.createTable('api_keys', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
          primaryKey: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        site_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'sites',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        key_prefix: {
          type: Sequelize.STRING(8),
          allowNull: false
        },
        key_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true
        },
        scopes: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: ['leads:read']
        },
        last_used_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      console.log('Created api_keys table');

      // Add indexes
      await safeAddIndex('api_keys', ['user_id'], { name: 'api_keys_user_id_idx' });
      await safeAddIndex('api_keys', ['site_id'], { name: 'api_keys_site_id_idx' });
      await safeAddIndex('api_keys', ['key_prefix'], { name: 'api_keys_key_prefix_idx' });
      await safeAddIndex('api_keys', ['is_active'], { name: 'api_keys_is_active_idx' });
    } else {
      console.log('api_keys table already exists, skipping');
    }

    // =============================================
    // ADD LEAD AUTO-RESPONDER SETTINGS TO SITES
    // =============================================
    if (existingTables.includes('sites')) {
      // Auto-responder enabled flag
      await safeAddColumn('sites', 'lead_autoresponder_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to send auto-reply emails to leads'
      });

      // Auto-responder subject
      await safeAddColumn('sites', 'lead_autoresponder_subject', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: 'Thank you for contacting us!',
        comment: 'Subject line for auto-reply email'
      });

      // Auto-responder body (HTML)
      await safeAddColumn('sites', 'lead_autoresponder_body', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'HTML body for auto-reply email. Supports {{name}}, {{email}} placeholders'
      });

      // Reply-to email for leads
      await safeAddColumn('sites', 'lead_reply_to_email', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Reply-to email address for lead notifications'
      });

      // Notification preferences
      await safeAddColumn('sites', 'lead_notification_enabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether to notify site owner of new leads'
      });
    }

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    const existingTables = await queryInterface.showAllTables();

    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        return columnName in tableDescription;
      } catch (error) {
        return false;
      }
    };

    // Helper function to safely remove column
    const safeRemoveColumn = async (tableName, columnName) => {
      if (!(await columnExists(tableName, columnName))) {
        console.log(`Column ${tableName}.${columnName} does not exist, skipping`);
        return;
      }
      console.log(`Removing column ${tableName}.${columnName}...`);
      await queryInterface.removeColumn(tableName, columnName);
      console.log(`Removed column ${tableName}.${columnName}`);
    };

    // Drop api_keys table
    if (existingTables.includes('api_keys')) {
      console.log('Dropping api_keys table...');
      await queryInterface.dropTable('api_keys');
      console.log('Dropped api_keys table');
    }

    // Remove lead settings from sites
    if (existingTables.includes('sites')) {
      await safeRemoveColumn('sites', 'lead_autoresponder_enabled');
      await safeRemoveColumn('sites', 'lead_autoresponder_subject');
      await safeRemoveColumn('sites', 'lead_autoresponder_body');
      await safeRemoveColumn('sites', 'lead_reply_to_email');
      await safeRemoveColumn('sites', 'lead_notification_enabled');
    }

    console.log('Rollback completed successfully');
  }
};
