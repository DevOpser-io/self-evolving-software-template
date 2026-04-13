/**
 * Script to run database migrations
 * This script ensures that config.json is created before running migrations
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

console.log('=== Migration Script ===');
console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Current directory: ${process.cwd()}`);

// Check if required environment variables are set
console.log('Checking for required environment variables:');
console.log(`DB_USER_SECRET_NAME: ${process.env.DB_USER_SECRET_NAME ? 'Set' : 'Not set'}`);
console.log(`DB_PASSWORD_SECRET_NAME: ${process.env.DB_PASSWORD_SECRET_NAME ? 'Set' : 'Not set'}`);
console.log(`DB_NAME_SECRET_NAME: ${process.env.DB_NAME_SECRET_NAME ? 'Set' : 'Not set'}`);
console.log(`DB_HOST_SECRET_NAME: ${process.env.DB_HOST_SECRET_NAME ? 'Set' : 'Not set'}`);
console.log(`DB_PORT_SECRET_NAME: ${process.env.DB_PORT_SECRET_NAME ? 'Set' : 'Not set'}`);

// Create .sequelizerc file if it doesn't exist
const sequelizeRcPath = path.resolve(process.cwd(), '.sequelizerc');
if (!fs.existsSync(sequelizeRcPath)) {
  console.log(`Creating .sequelizerc at ${sequelizeRcPath}`);
  const sequelizeRcContent = `const path = require('path');

module.exports = {
  'config': path.resolve('config', 'config.json'),
  'models-path': path.resolve('models'),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations')
};
`;
  fs.writeFileSync(sequelizeRcPath, sequelizeRcContent, 'utf8');
  console.log('.sequelizerc file created successfully');
}

// Create a direct database config with the secrets
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getSecret(secretName, region = process.env.REGION || 'us-east-1') {
  if (!secretName) {
    console.error('Secret name not provided');
    return null;
  }
  
  console.log(`Retrieving secret: ${secretName} from region: ${region}`);
  
  try {
    const client = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    if (response.SecretString) {
      console.log(`Successfully retrieved secret: ${secretName}`);
      return response.SecretString;
    } else {
      console.error(`Secret ${secretName} has no string value`);
      return null;
    }
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}: ${error.message}`);
    return null;
  }
}

async function generateConfigJson() {
  // Create a direct database config with the secrets
  const dbConfig = {
    development: {
      username: 'devuser',
      password: 'password',
      database: 'devdb',
      host: 'localhost',
      port: 5432,
      dialect: 'postgres',
      logging: false
    },
    test: {
      username: 'devuser',
      password: 'password',
      database: 'devdb',
      host: 'localhost',
      port: 5432,
      dialect: 'postgres',
      logging: false
    },
    production: {
      username: 'devuser',
      password: 'password',
      database: 'devdb',
      host: 'localhost',
      port: 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.DB_REQUIRE_SSL === 'true' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    }
  };

  // If in production mode and we have secret names, retrieve the secrets
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DB_USER_SECRET_NAME) {
      const dbUser = await getSecret(process.env.DB_USER_SECRET_NAME);
      if (dbUser) {
        dbConfig.production.username = dbUser;
        console.log(`Updated username from secret ${process.env.DB_USER_SECRET_NAME}`);
      }
    }

    if (process.env.DB_PASSWORD_SECRET_NAME) {
      const dbPassword = await getSecret(process.env.DB_PASSWORD_SECRET_NAME);
      if (dbPassword) {
        dbConfig.production.password = dbPassword;
        console.log(`Updated password from secret ${process.env.DB_PASSWORD_SECRET_NAME}`);
      }
    }

    if (process.env.DB_NAME_SECRET_NAME) {
      const dbName = await getSecret(process.env.DB_NAME_SECRET_NAME);
      if (dbName) {
        dbConfig.production.database = dbName;
        console.log(`Updated database name to ${dbConfig.production.database} from secret ${process.env.DB_NAME_SECRET_NAME}`);
      }
    }

    if (process.env.DB_HOST_SECRET_NAME) {
      const dbHost = await getSecret(process.env.DB_HOST_SECRET_NAME);
      if (dbHost) {
        dbConfig.production.host = dbHost;
        console.log(`Updated host to ${dbConfig.production.host} from secret ${process.env.DB_HOST_SECRET_NAME}`);
      }
    }

    if (process.env.DB_PORT_SECRET_NAME) {
      const dbPort = await getSecret(process.env.DB_PORT_SECRET_NAME);
      if (dbPort) {
        dbConfig.production.port = parseInt(dbPort, 10);
        console.log(`Updated port to ${dbConfig.production.port} from secret ${process.env.DB_PORT_SECRET_NAME}`);
      }
    }
  }

  // Create the config directory if it doesn't exist
  const configDir = path.resolve(process.cwd(), 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write the configuration to config.json
  const configPath = path.resolve(configDir, 'config.json');
  console.log(`Generating config.json at ${configPath}`);

  fs.writeFileSync(
    configPath,
    JSON.stringify(dbConfig, null, 2)
  );

  console.log('Configuration written to config.json');
  console.log('Production configuration:', {
    ...dbConfig.production,
    password: '***MASKED***'
  });

  return dbConfig;
}

// Main function to run migrations
async function runMigrations() {
  try {
    // Generate config.json with the latest secrets
    await generateConfigJson();
    
    // Run the migrations
    console.log('\n=== Running database migrations ===');
    
    const result = spawnSync('npx', ['sequelize-cli', 'db:migrate'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DB_REQUIRE_SSL: 'true'
      }
    });
    
    if (result.status === 0) {
      console.log('Migrations completed successfully');
    } else {
      console.error(`Migrations failed with exit code ${result.status}`);
      process.exit(result.status);
    }
  } catch (error) {
    console.error('Error running migrations:', error.message);
    process.exit(1);
  }
}

// Run the migrations
runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
