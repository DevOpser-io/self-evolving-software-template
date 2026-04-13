'use strict';

/**
 * Migration: Add Leads table
 * Stores leads captured from customer websites via contact forms
 *
 * This migration is IDEMPOTENT - it checks for table existence before creating.
 * Safe to run multiple times without errors.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get existing tables to ensure idempotency
    const existingTables = await queryInterface.showAllTables();
    console.log('Existing tables:', existingTables);

    // Create Leads table
    if (!existingTables.includes('Leads')) {
      console.log('Creating Leads table...');
      await queryInterface.createTable('Leads', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        site_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'sites',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        form_data: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        source: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Section ID or form identifier where lead was captured'
        },
        ip_address: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: 'IP address of the visitor'
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Browser user agent string'
        },
        referrer: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Referrer URL'
        },
        status: {
          type: Sequelize.ENUM('new', 'contacted', 'qualified', 'converted', 'archived'),
          defaultValue: 'new',
          allowNull: false
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Internal notes about this lead'
        },
        submitted_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
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
      console.log('Created Leads table');

      // Add indexes for performance
      try {
        await queryInterface.addIndex('Leads', ['site_id'], { name: 'leads_site_id_idx' });
        console.log('Created leads_site_id_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('leads_site_id_idx index already exists, skipping');
      }

      try {
        await queryInterface.addIndex('Leads', ['status'], { name: 'leads_status_idx' });
        console.log('Created leads_status_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('leads_status_idx index already exists, skipping');
      }

      try {
        await queryInterface.addIndex('Leads', ['submitted_at'], { name: 'leads_submitted_at_idx' });
        console.log('Created leads_submitted_at_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('leads_submitted_at_idx index already exists, skipping');
      }

      try {
        await queryInterface.addIndex('Leads', ['site_id', 'status'], { name: 'leads_site_status_idx' });
        console.log('Created leads_site_status_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('leads_site_status_idx index already exists, skipping');
      }
    } else {
      console.log('Leads table already exists, skipping');
    }

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    // Get existing tables to ensure idempotency
    const existingTables = await queryInterface.showAllTables();

    if (existingTables.includes('Leads')) {
      console.log('Dropping Leads table...');
      await queryInterface.dropTable('Leads');
      console.log('Dropped Leads table');
    } else {
      console.log('Leads table does not exist, skipping');
    }

    // Drop ENUM type (PostgreSQL-specific cleanup)
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Leads_status";');
      console.log('Dropped enum_Leads_status type');
    } catch (error) {
      console.log('Could not drop enum_Leads_status:', error.message);
    }

    console.log('Rollback completed successfully');
  }
};
