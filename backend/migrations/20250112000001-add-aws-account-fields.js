'use strict';

/**
 * Migration: Add AWS Account and Deployment tracking fields
 *
 * This migration is IDEMPOTENT - it checks for column/table existence before creating.
 * Safe to run multiple times without errors.
 *
 * Adds:
 * - AWS account fields to users table (for multi-account architecture)
 * - Deployment status fields to sites table
 * - aws_account_provisions table for tracking account creation
 * - site_deployments table for deployment history (if not using existing deployments table)
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get existing tables to ensure idempotency
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
    // ADD AWS ACCOUNT FIELDS TO USERS TABLE
    // =============================================
    if (existingTables.includes('Users') || existingTables.includes('users')) {
      const usersTable = existingTables.includes('Users') ? 'Users' : 'users';

      await safeAddColumn(usersTable, 'aws_account_id', {
        type: Sequelize.STRING(12),
        allowNull: true,
        comment: 'Customer AWS account ID'
      });

      // Create ENUM type first if needed for aws_account_status
      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "enum_users_aws_account_status" AS ENUM ('pending', 'creating', 'active', 'suspended', 'closed', 'failed');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      } catch (error) {
        console.log('ENUM type enum_users_aws_account_status may already exist');
      }

      await safeAddColumn(usersTable, 'aws_account_status', {
        type: Sequelize.ENUM('pending', 'creating', 'active', 'suspended', 'closed', 'failed'),
        allowNull: true,
        defaultValue: null,
        comment: 'Status of customer AWS account'
      });

      await safeAddColumn(usersTable, 'aws_external_id', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'External ID for cross-account role assumption'
      });

      await safeAddColumn(usersTable, 'aws_account_created_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the AWS account was created'
      });
    }

    // =============================================
    // ADD DEPLOYMENT FIELDS TO SITES TABLE
    // =============================================
    if (existingTables.includes('sites')) {
      // Note: lightsail_service_name already exists from initial migration

      await safeAddColumn('sites', 'lightsail_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Lightsail container service URL'
      });

      // Create ENUM type first if needed for deployment_status
      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "enum_sites_deployment_status" AS ENUM ('none', 'pending', 'creating_service', 'deploying', 'active', 'failed');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      } catch (error) {
        console.log('ENUM type enum_sites_deployment_status may already exist');
      }

      await safeAddColumn('sites', 'deployment_status', {
        type: Sequelize.ENUM('none', 'pending', 'creating_service', 'deploying', 'active', 'failed'),
        allowNull: true,
        defaultValue: 'none',
        comment: 'Current deployment status'
      });

      await safeAddColumn('sites', 'last_deployed_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the site was last deployed'
      });

      await safeAddColumn('sites', 'deployment_error', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Last deployment error message'
      });

      // Add index for deployment_status
      await safeAddIndex('sites', ['deployment_status'], {
        name: 'sites_deployment_status_idx'
      });
    }

    // =============================================
    // CREATE AWS_ACCOUNT_PROVISIONS TABLE
    // =============================================
    if (!existingTables.includes('aws_account_provisions')) {
      console.log('Creating aws_account_provisions table...');

      // Create ENUM type first
      try {
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "enum_aws_account_provisions_status" AS ENUM ('pending', 'in_progress', 'succeeded', 'failed');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
      } catch (error) {
        console.log('ENUM type enum_aws_account_provisions_status may already exist');
      }

      await queryInterface.createTable('aws_account_provisions', {
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
        aws_account_id: {
          type: Sequelize.STRING(12),
          allowNull: true
        },
        request_id: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'AWS Organizations CreateAccount request ID'
        },
        external_id: {
          type: Sequelize.UUID,
          allowNull: false,
          defaultValue: Sequelize.literal('gen_random_uuid()')
        },
        status: {
          type: Sequelize.ENUM('pending', 'in_progress', 'succeeded', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true
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
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      });
      console.log('Created aws_account_provisions table');

      // Add indexes
      await safeAddIndex('aws_account_provisions', ['user_id'], {
        name: 'aws_account_provisions_user_id_idx'
      });
      await safeAddIndex('aws_account_provisions', ['aws_account_id'], {
        name: 'aws_account_provisions_aws_account_id_idx'
      });
      await safeAddIndex('aws_account_provisions', ['status'], {
        name: 'aws_account_provisions_status_idx'
      });
    } else {
      console.log('aws_account_provisions table already exists, skipping');
    }

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    // Get existing tables to ensure idempotency
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

    // =============================================
    // DROP AWS_ACCOUNT_PROVISIONS TABLE
    // =============================================
    if (existingTables.includes('aws_account_provisions')) {
      console.log('Dropping aws_account_provisions table...');
      await queryInterface.dropTable('aws_account_provisions');
      console.log('Dropped aws_account_provisions table');
    }

    // =============================================
    // REMOVE DEPLOYMENT FIELDS FROM SITES TABLE
    // =============================================
    if (existingTables.includes('sites')) {
      await safeRemoveColumn('sites', 'lightsail_url');
      await safeRemoveColumn('sites', 'deployment_status');
      await safeRemoveColumn('sites', 'last_deployed_at');
      await safeRemoveColumn('sites', 'deployment_error');
    }

    // =============================================
    // REMOVE AWS ACCOUNT FIELDS FROM USERS TABLE
    // =============================================
    const usersTable = existingTables.includes('Users') ? 'Users' : 'users';
    if (existingTables.includes('Users') || existingTables.includes('users')) {
      await safeRemoveColumn(usersTable, 'aws_account_id');
      await safeRemoveColumn(usersTable, 'aws_account_status');
      await safeRemoveColumn(usersTable, 'aws_external_id');
      await safeRemoveColumn(usersTable, 'aws_account_created_at');
    }

    // =============================================
    // DROP ENUM TYPES
    // =============================================
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_aws_account_status";');
      console.log('Dropped enum_users_aws_account_status type');
    } catch (error) {
      console.log('Could not drop enum_users_aws_account_status:', error.message);
    }

    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sites_deployment_status";');
      console.log('Dropped enum_sites_deployment_status type');
    } catch (error) {
      console.log('Could not drop enum_sites_deployment_status:', error.message);
    }

    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_aws_account_provisions_status";');
      console.log('Dropped enum_aws_account_provisions_status type');
    } catch (error) {
      console.log('Could not drop enum_aws_account_provisions_status:', error.message);
    }

    console.log('Rollback completed successfully');
  }
};
