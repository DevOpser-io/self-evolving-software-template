'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper to check if table exists
    const tableExists = async (tableName) => {
      const [result] = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = '${tableName}'
        );
      `);
      return result[0].exists;
    };

    // Create Users table if it doesn't exist
    if (!(await tableExists('Users'))) {
      await queryInterface.createTable('Users', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING,
          unique: true,
          allowNull: false
        },
        passwordHash: Sequelize.STRING,
        name: Sequelize.STRING,
        isAdmin: { type: Sequelize.BOOLEAN, defaultValue: false },
        isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
        createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        lastLogin: Sequelize.DATE,
        mfaSecret: Sequelize.STRING,
        mfaEnabled: { type: Sequelize.BOOLEAN, defaultValue: false },
        hasAuthenticator: { type: Sequelize.BOOLEAN, defaultValue: false },
        isMfaSetupComplete: { type: Sequelize.BOOLEAN, defaultValue: false },
        emailVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
        emailVerificationToken: Sequelize.STRING,
        emailVerificationSentAt: Sequelize.DATE,
        backupCodesHash: Sequelize.JSON,
        preferredMfaMethod: { type: Sequelize.STRING, defaultValue: 'authenticator' },
        passwordResetToken: Sequelize.STRING,
        passwordResetSentAt: Sequelize.DATE,
        resetPasswordToken: Sequelize.STRING,
        resetPasswordExpires: Sequelize.DATE,
        subscriptionId: Sequelize.STRING,
        googleId: { type: Sequelize.STRING, unique: true, allowNull: true },
        githubId: { type: Sequelize.STRING, unique: true, allowNull: true },
        oauthProvider: Sequelize.STRING
      });
      console.log('Created Users table');
    } else {
      console.log('Users table already exists - skipping');
    }

    // Create conversations table if it doesn't exist
    if (!(await tableExists('conversations'))) {
      await queryInterface.createTable('conversations', {
        conversation_id: {
          type: Sequelize.STRING,
          primaryKey: true,
          allowNull: false,
          unique: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        chat_history: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: []
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        ended_at: Sequelize.DATE,
        is_temporary: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });
      await queryInterface.addIndex('conversations', ['user_id']);
      await queryInterface.addIndex('conversations', ['started_at']);
      console.log('Created conversations table');
    } else {
      console.log('conversations table already exists - skipping');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversations');
    await queryInterface.dropTable('Users');
  }
};
