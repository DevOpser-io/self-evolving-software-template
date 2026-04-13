// File: backend/scripts/init-admin-users.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getSecret } = require('../services/secretsManager');
require('dotenv').config();

(async () => {
  let tmpEnvPath = null;
  
  try {
    console.log('=== Starting admin user initialization ===');

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    console.log(`Running in ${nodeEnv} mode`);

    let dbName, dbUser, dbPassword, dbHost, dbPort, adminUsers;
    
    if (isProduction) {
      // 1. Pull region and secret-names from env
      const region = process.env.REGION || 'us-east-1';
      const dbNameSecretName = process.env.DB_NAME_SECRET_NAME;
      const dbUserSecretName = process.env.DB_USER_SECRET_NAME;
      const dbPasswordSecretName = process.env.DB_PASSWORD_SECRET_NAME;
      const dbHostSecretName = process.env.DB_HOST_SECRET_NAME;
      const dbPortSecretName = process.env.DB_PORT_SECRET_NAME;
      const adminUsersSecretName = process.env.ADMIN_USERS_SECRET_NAME;

      // 2. Ensure all secrets are present
      const missing = [];
      if (!dbNameSecretName) missing.push('DB_NAME_SECRET_NAME');
      if (!dbUserSecretName) missing.push('DB_USER_SECRET_NAME');
      if (!dbPasswordSecretName) missing.push('DB_PASSWORD_SECRET_NAME');
      if (!dbHostSecretName) missing.push('DB_HOST_SECRET_NAME');
      if (!dbPortSecretName) missing.push('DB_PORT_SECRET_NAME');
      if (!adminUsersSecretName) missing.push('ADMIN_USERS_SECRET_NAME');
      
      if (missing.length) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
      }

      // 3. Fetch DB secrets
      console.log(`Fetching DB_NAME from Secrets Manager ("${dbNameSecretName}")`);
      dbName = await getSecret(dbNameSecretName, region);
      if (!dbName) throw new Error(`Secret ${dbNameSecretName} returned empty`);
      
      console.log(`Fetching DB_USER from Secrets Manager ("${dbUserSecretName}")`);
      dbUser = await getSecret(dbUserSecretName, region);
      if (!dbUser) throw new Error(`Secret ${dbUserSecretName} returned empty`);
      
      console.log(`Fetching DB_PASSWORD from Secrets Manager ("${dbPasswordSecretName}")`);
      dbPassword = await getSecret(dbPasswordSecretName, region);
      if (!dbPassword) throw new Error(`Secret ${dbPasswordSecretName} returned empty`);
      
      console.log(`Fetching DB_HOST from Secrets Manager ("${dbHostSecretName}")`);
      dbHost = await getSecret(dbHostSecretName, region);
      if (!dbHost) throw new Error(`Secret ${dbHostSecretName} returned empty`);
      
      console.log(`Fetching DB_PORT from Secrets Manager ("${dbPortSecretName}")`);
      const rawPort = await getSecret(dbPortSecretName, region);
      if (!rawPort) throw new Error(`Secret ${dbPortSecretName} returned empty`);
      dbPort = parseInt(rawPort, 10);
      if (isNaN(dbPort)) throw new Error(`Invalid port from ${dbPortSecretName}: "${rawPort}"`);
      console.log(`→ DB_PORT = ${dbPort}`);

      // 4. Fetch admin users data
      console.log(`Fetching admin users data from Secrets Manager ("${adminUsersSecretName}")`);
      const adminUsersData = await getSecret(adminUsersSecretName, region);
      if (!adminUsersData) throw new Error(`Secret ${adminUsersSecretName} returned empty`);
      
      try {
        adminUsers = JSON.parse(adminUsersData);
        if (!adminUsers.admin_users || !Array.isArray(adminUsers.admin_users) || adminUsers.admin_users.length === 0) {
          throw new Error('Invalid admin users format');
        }
      } catch (error) {
        console.error(`Failed to parse admin users data: ${error.message}`);
        process.exit(1);
      }
    } else {
      // Development mode - use hardcoded values
      console.log('Using development database credentials');
      dbName = 'devdb';
      dbUser = 'devuser';
      dbPassword = 'password';
      dbHost = 'localhost';
      dbPort = 5432;
      
      // Sample admin users for development
      adminUsers = {
        admin_users: [
          { email: 'admin@example.com', password: 'adminpass' }
        ]
      };
      console.log('Using development admin users:', JSON.stringify(adminUsers, null, 2));
    }

    // 5. Create temporary .env file with DB connection info
    tmpEnvPath = path.resolve(__dirname, '../temp/.env.admin');
    const tempDir = path.resolve(__dirname, '../temp');
    fs.mkdirSync(tempDir, { recursive: true });
    
    const envContent = `
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_HOST=${dbHost}
DB_PORT=${dbPort}
NODE_ENV=${nodeEnv}
DB_DIALECT=postgres
DB_SSL=${isProduction ? 'true' : 'false'}
DB_REJECT_UNAUTHORIZED=${isProduction ? 'false' : 'true'}
`;
    
    fs.writeFileSync(tmpEnvPath, envContent);
    console.log(`Wrote temporary .env file for admin creation`);

    // 6. Create each admin user using the existing create-admin.js script
    console.log(`Creating ${adminUsers.admin_users.length} admin users...`);
    
    for (const admin of adminUsers.admin_users) {
      if (!admin.email || !admin.password) {
        console.warn('Skipping admin user with missing email or password');
        continue;
      }
      
      try {
        console.log(`Creating admin user: ${admin.email}`);
        
        // Run the create-admin.js script with the temporary .env file
        const command = `cd ${__dirname} && NODE_ENV=${nodeEnv} DOTENV_CONFIG_PATH=${tmpEnvPath} node create-admin.js "${admin.email}" "${admin.password}"`;
        const output = execSync(command, { encoding: 'utf8' });
        console.log(output);
      } catch (error) {
        console.error(`Error creating admin user ${admin.email}: ${error.message}`);
        if (error.stdout) console.error(error.stdout);
        if (error.stderr) console.error(error.stderr);
      }
    }
    
    console.log('=== Admin user initialization complete! ===');
    
  } catch (error) {
    console.error(`Error initializing admin users: ${error.message}`);
    process.exit(1);
  } finally {
    // Clean up the temporary env file
    if (tmpEnvPath && fs.existsSync(tmpEnvPath)) {
      fs.unlinkSync(tmpEnvPath);
      console.log('Removed temporary .env file');
    }
  }
})();
