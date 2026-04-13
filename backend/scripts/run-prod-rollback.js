// File: backend/scripts/run-prod-rollback.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getSecret } = require('../services/secretsManager'); // use existing getSecret()
require('dotenv').config(); // load any .env if needed

(async () => {
  let tmpConfigPath = null;
  
  try {
    console.log('=== Starting production rollback script ===');

    // 1. Pull region and secret-names from env
    const region              = process.env.REGION              || 'us-east-1';
    const dbNameSecretName    = process.env.DB_NAME_SECRET_NAME;
    const dbUserSecretName    = process.env.DB_USER_SECRET_NAME;
    const dbPasswordSecretName= process.env.DB_PASSWORD_SECRET_NAME;
    const dbHostSecretName    = process.env.DB_HOST_SECRET_NAME;
    const dbPortSecretName    = process.env.DB_PORT_SECRET_NAME;

    // 2. Ensure all five are present
    const missing = [];
    if (!dbNameSecretName)     missing.push('DB_NAME_SECRET_NAME');
    if (!dbUserSecretName)     missing.push('DB_USER_SECRET_NAME');
    if (!dbPasswordSecretName) missing.push('DB_PASSWORD_SECRET_NAME');
    if (!dbHostSecretName)     missing.push('DB_HOST_SECRET_NAME');
    if (!dbPortSecretName)     missing.push('DB_PORT_SECRET_NAME');
    if (missing.length) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    }

    // 3. Fetch each secret (throws if anything goes wrong)
    console.log(`Fetching DB_NAME from Secrets Manager ("${dbNameSecretName}")`);
    const dbName     = await getSecret(dbNameSecretName, region);
    if (!dbName)     throw new Error(`Secret ${dbNameSecretName} returned empty`);
    console.log(`→ DB_NAME retrieved`);

    console.log(`Fetching DB_USER from Secrets Manager ("${dbUserSecretName}")`);
    const dbUser     = await getSecret(dbUserSecretName, region);
    if (!dbUser)     throw new Error(`Secret ${dbUserSecretName} returned empty`);
    console.log(`→ DB_USER retrieved`);

    console.log(`Fetching DB_PASSWORD from Secrets Manager ("${dbPasswordSecretName}")`);
    const dbPassword = await getSecret(dbPasswordSecretName, region);
    if (!dbPassword) throw new Error(`Secret ${dbPasswordSecretName} returned empty`);
    console.log(`→ DB_PASSWORD retrieved (hidden)`);

    console.log(`Fetching DB_HOST from Secrets Manager ("${dbHostSecretName}")`);
    const dbHost     = await getSecret(dbHostSecretName, region);
    if (!dbHost)     throw new Error(`Secret ${dbHostSecretName} returned empty`);
    console.log(`→ DB_HOST retrieved`);

    console.log(`Fetching DB_PORT from Secrets Manager ("${dbPortSecretName}")`);
    const rawPort    = await getSecret(dbPortSecretName, region);
    if (!rawPort)    throw new Error(`Secret ${dbPortSecretName} returned empty`);
    const dbPort     = parseInt(rawPort, 10);
    if (Number.isNaN(dbPort)) throw new Error(`Invalid port from ${dbPortSecretName}: "${rawPort}"`);
    console.log(`→ DB_PORT = ${dbPort}`);

    // 4. Build the Sequelize config JSON
    const sequelizeConfig = {
      development: {
        username: 'devuser',
        password: 'password',
        database: 'devdb',
        host:     'localhost',
        port:     5432,
        dialect:  'postgres',
        logging:  false
      },
      production: {
        username: dbUser,
        password: dbPassword,
        database: dbName,
        host:     dbHost,
        port:     dbPort,
        dialect:  'postgres',
        logging:  console.log,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      }
    };

    // 5. Write it to a temp config file
    const tempDir = path.resolve(__dirname, '../temp');
    tmpConfigPath = path.resolve(tempDir, 'prod-db-config.json');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(tmpConfigPath, JSON.stringify(sequelizeConfig, null, 2));
    console.log(`Wrote Sequelize config → ${tmpConfigPath}`);

    // 6. Finally, run Sequelize CLI rollback (undo the last migration)
    console.log('Running `npx sequelize-cli db:migrate:undo --env production --config ' + tmpConfigPath + '`');
    execSync(
      `npx sequelize-cli db:migrate:undo --env production --config "${tmpConfigPath}"`,
      { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
    );

    // 7. Clean up the temporary config file
    if (tmpConfigPath && fs.existsSync(tmpConfigPath)) {
      fs.unlinkSync(tmpConfigPath);
      console.log(`Removed temporary config file`);
    }

    console.log('=== Rollback complete! ===');
    process.exit(0);

  } catch (err) {
    console.error('*** Rollback failed: ', err);
    
    // Clean up the temporary config file if it exists
    if (tmpConfigPath && fs.existsSync(tmpConfigPath)) {
      try {
        fs.unlinkSync(tmpConfigPath);
        console.log(`Cleaned up temporary config file after error`);
      } catch (cleanupErr) {
        console.error(`Failed to clean up temporary config file: ${cleanupErr.message}`);
      }
    }
    
    process.exit(1);
  }
})();