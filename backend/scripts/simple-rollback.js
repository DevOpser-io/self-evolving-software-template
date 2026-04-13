#!/usr/bin/env node

const { Sequelize } = require('sequelize');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getSecret(secretName) {
  const client = new SecretsManagerClient({ region: process.env.REGION || 'us-east-1' });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  return response.SecretString;
}

async function rollback() {
  // Get database credentials from AWS Secrets Manager
  const [username, password, database, host, port] = await Promise.all([
    getSecret(process.env.DB_USER_SECRET_NAME),
    getSecret(process.env.DB_PASSWORD_SECRET_NAME),
    getSecret(process.env.DB_NAME_SECRET_NAME),
    getSecret(process.env.DB_HOST_SECRET_NAME),
    getSecret(process.env.DB_PORT_SECRET_NAME)
  ]);

  // Connect to database
  const sequelize = new Sequelize(database, username, password, {
    host,
    port: parseInt(port),
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: process.env.DB_REQUIRE_SSL === 'true' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {}
  });

  try {
    // Get the last migration from SequelizeMeta table
    const [lastMigration] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1',
      { type: sequelize.QueryTypes.SELECT }
    );

    if (!lastMigration) {
      console.log('No migrations to rollback');
      return;
    }

    console.log(`Rolling back migration: ${lastMigration.name}`);

    // Load and execute the down method of the migration
    const migrationPath = require('path').join(__dirname, '..', 'migrations', lastMigration.name);
    const migration = require(migrationPath);
    
    if (migration.down) {
      await migration.down(sequelize.getQueryInterface(), Sequelize);
      
      // Remove from SequelizeMeta
      await sequelize.query(
        'DELETE FROM "SequelizeMeta" WHERE name = :name',
        { 
          replacements: { name: lastMigration.name },
          type: sequelize.QueryTypes.DELETE 
        }
      );
      
      console.log('Rollback completed successfully');
    } else {
      console.error('Migration has no down method');
      process.exit(1);
    }
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

rollback().catch(console.error);