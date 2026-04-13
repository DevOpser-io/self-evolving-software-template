'use strict';

/**
 * Migration: Add Sites, Deployments, and SiteImages tables for DevOpser Lite
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

    // Create Sites table
    if (!existingTables.includes('sites')) {
      console.log('Creating sites table...');
      await queryInterface.createTable('sites', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        slug: {
          type: Sequelize.STRING(100),
          allowNull: false,
          unique: true
        },
        github_repo_url: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        lightsail_service_name: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        lightsail_endpoint: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('draft', 'deploying', 'published', 'failed'),
          allowNull: false,
          defaultValue: 'draft'
        },
        draft_config: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        published_config: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        custom_domain: {
          type: Sequelize.STRING(255),
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
        }
      });
      console.log('Created sites table');

      // Add indexes for sites table
      try {
        await queryInterface.addIndex('sites', ['slug'], {
          unique: true,
          name: 'sites_slug_unique'
        });
        console.log('Created sites_slug_unique index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('sites_slug_unique index already exists, skipping');
      }

      try {
        await queryInterface.addIndex('sites', ['user_id'], {
          name: 'sites_user_id_idx'
        });
        console.log('Created sites_user_id_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('sites_user_id_idx index already exists, skipping');
      }
    } else {
      console.log('sites table already exists, skipping');
    }

    // Create Deployments table
    if (!existingTables.includes('deployments')) {
      console.log('Creating deployments table...');
      await queryInterface.createTable('deployments', {
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
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        status: {
          type: Sequelize.ENUM('pending', 'building', 'deploying', 'success', 'failed'),
          allowNull: false,
          defaultValue: 'pending'
        },
        config_snapshot: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        lightsail_deployment_id: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true
        }
      });
      console.log('Created deployments table');

      // Add index for deployments table
      try {
        await queryInterface.addIndex('deployments', ['site_id'], {
          name: 'deployments_site_id_idx'
        });
        console.log('Created deployments_site_id_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('deployments_site_id_idx index already exists, skipping');
      }
    } else {
      console.log('deployments table already exists, skipping');
    }

    // Create SiteImages table (for AI-generated images)
    if (!existingTables.includes('site_images')) {
      console.log('Creating site_images table...');
      await queryInterface.createTable('site_images', {
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
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        prompt: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        s3_key: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        cloudfront_url: {
          type: Sequelize.STRING(500),
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      console.log('Created site_images table');

      // Add index for site_images table
      try {
        await queryInterface.addIndex('site_images', ['site_id'], {
          name: 'site_images_site_id_idx'
        });
        console.log('Created site_images_site_id_idx index');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
        console.log('site_images_site_id_idx index already exists, skipping');
      }
    } else {
      console.log('site_images table already exists, skipping');
    }

    console.log('Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    // Get existing tables to ensure idempotency
    const existingTables = await queryInterface.showAllTables();

    // Drop tables in reverse order of creation (due to foreign keys)
    if (existingTables.includes('site_images')) {
      console.log('Dropping site_images table...');
      await queryInterface.dropTable('site_images');
      console.log('Dropped site_images table');
    }

    if (existingTables.includes('deployments')) {
      console.log('Dropping deployments table...');
      await queryInterface.dropTable('deployments');
      console.log('Dropped deployments table');
    }

    if (existingTables.includes('sites')) {
      console.log('Dropping sites table...');
      await queryInterface.dropTable('sites');
      console.log('Dropped sites table');
    }

    // Drop ENUMs (PostgreSQL-specific cleanup)
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sites_status";');
      console.log('Dropped enum_sites_status type');
    } catch (error) {
      console.log('Could not drop enum_sites_status:', error.message);
    }

    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_deployments_status";');
      console.log('Dropped enum_deployments_status type');
    } catch (error) {
      console.log('Could not drop enum_deployments_status:', error.message);
    }

    console.log('Rollback completed successfully');
  }
};
