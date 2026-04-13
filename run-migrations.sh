#!/bin/bash

set -e

echo "===== Starting database migration process ====="

# Print current directory and contents
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

# Debug info
echo "===== Environment Information ====="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Change to the backend directory where sequelize is installed
echo "===== Changing to backend directory ====="
cd backend
echo "Now in directory: $(pwd)"
echo "Backend directory contents:"
ls -la

# Check if sequelize is installed in backend
echo "Checking for sequelize in backend:"
npm list sequelize sequelize-cli pg pg-hstore

# Print environment variables (excluding secrets)
echo "===== Environment Variables ====="
env | grep -v -E 'SECRET|PASSWORD|KEY'

# Check if .sequelizerc exists in parent directory
echo "===== Sequelize Configuration ====="
if [ -f "../.sequelizerc" ]; then
  echo ".sequelizerc file exists in parent directory:"
  cat ../.sequelizerc
else
  echo "Creating temporary .sequelizerc file for this run"
  echo 'const path = require("path");

module.exports = {
  "config": path.resolve("config/database.js"),
  "models-path": path.resolve("models"),
  "seeders-path": path.resolve("seeders"),
  "migrations-path": path.resolve("migrations")
};' > .sequelizerc
  echo "Created temporary .sequelizerc:"
  cat .sequelizerc
fi

# Check database config
echo "===== Database Configuration ====="
if [ -f "config/database.js" ]; then
  echo "Database config exists"
  # Print database config (with passwords masked)
  node -e "try { const config = require('./config/index'); const dbConfig = { ...config.database, password: '***MASKED***' }; console.log(JSON.stringify(dbConfig, null, 2)); } catch(e) { console.error('Error loading config:', e.message); }"
else
  echo "Database config file not found"
fi

# List migrations
echo "===== Available Migrations ====="
if [ -d "migrations" ]; then
  echo "Migrations directory exists:"
  ls -la migrations
else
  echo "Migrations directory not found"
fi

# Create a script to retrieve database credentials from AWS Secrets Manager
echo "===== Creating Secret Retrieval Script ====="
cat > retrieve-secrets.js << 'EOL'
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');

// Print information about the environment
console.log(`Node.js version: ${process.version}`);
console.log('Using AWS SDK v3 for Secrets Manager');

// Function to get a secret from AWS Secrets Manager
async function getSecret(secretName, region) {
  if (!secretName) {
    console.error('Secret name not provided');
    return null;
  }
  
  console.log(`Retrieving secret: ${secretName} from region: ${region}`);
  
  try {
    // Create AWS Secrets Manager client
    const client = new SecretsManagerClient({
      region,
      maxAttempts: 3,
      retryMode: 'standard'
    });

    // Create the command to get the secret value
    const command = new GetSecretValueCommand({ SecretId: secretName });

    console.log(`Sending request to AWS Secrets Manager for secret: ${secretName}`);
    const response = await client.send(command);
    
    if (!response.SecretString) {
      console.error(`Secret ${secretName} has no string value`);
      return null;
    }
    
    console.log(`Successfully retrieved secret: ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}: ${error.message}`);
    console.error(`Error name: ${error.name}`);
    
    if (error.name === 'ResourceNotFoundException') {
      console.error(`Secret ${secretName} not found`);
    } else if (error.name === 'AccessDeniedException') {
      console.error(`Access denied to secret ${secretName}`);
    } else if (error.name === 'InvalidParameterException') {
      console.error(`Invalid parameter for secret ${secretName}`);
    } else if (error.name === 'InvalidRequestException') {
      console.error(`Invalid request for secret ${secretName}`);
    }
    
    return null;
  }
}

async function main() {
  try {
    // Get environment variables
    const region = process.env.REGION || 'us-east-1';
    const dbNameSecretName = process.env.DB_NAME_SECRET_NAME;
    const dbUserSecretName = process.env.DB_USER_SECRET_NAME;
    const dbPasswordSecretName = process.env.DB_PASSWORD_SECRET_NAME;
    const dbHostSecretName = process.env.DB_HOST_SECRET_NAME;
    const dbPortSecretName = process.env.DB_PORT_SECRET_NAME;
    
    // Print environment variables for debugging
    console.log('Environment variables:');
    console.log(`REGION: ${region}`);
    console.log(`DB_NAME_SECRET_NAME: ${dbNameSecretName || 'Not set'}`);
    console.log(`DB_USER_SECRET_NAME: ${dbUserSecretName || 'Not set'}`);
    console.log(`DB_PASSWORD_SECRET_NAME: ${dbPasswordSecretName ? 'Set' : 'Not set'}`);
    console.log(`DB_HOST_SECRET_NAME: ${dbHostSecretName || 'Not set'}`);
    console.log(`DB_PORT_SECRET_NAME: ${dbPortSecretName || 'Not set'}`);
    
    // Check if all required secret names are provided
    if (!dbNameSecretName || !dbUserSecretName || !dbPasswordSecretName || 
        !dbHostSecretName || !dbPortSecretName) {
      console.error('Missing required database secret names in environment variables');
      console.error('Will use default values for missing secrets');
    }
    
    // Default values in case secrets cannot be retrieved - using the development credentials from config.py
    let dbName = 'devdb';
    let dbUser = 'devuser';
    let dbPassword = 'password';
    let dbHost = 'localhost';
    let dbPort = 5432;
    
    // Retrieve secrets from AWS Secrets Manager
    if (dbNameSecretName) {
      const retrievedDbName = await getSecret(dbNameSecretName, region);
      if (retrievedDbName) {
        dbName = retrievedDbName;
        console.log(`Using database name from secret: ${dbName}`);
      } else {
        console.warn(`Failed to retrieve database name, using default: ${dbName}`);
      }
    }
    
    if (dbUserSecretName) {
      const retrievedDbUser = await getSecret(dbUserSecretName, region);
      if (retrievedDbUser) {
        dbUser = retrievedDbUser;
        console.log(`Using username from secret: ${dbUser}`);
      } else {
        console.warn(`Failed to retrieve username, using default: ${dbUser}`);
      }
    }
    
    if (dbPasswordSecretName) {
      const retrievedDbPassword = await getSecret(dbPasswordSecretName, region);
      if (retrievedDbPassword) {
        dbPassword = retrievedDbPassword;
        console.log('Using password from secret');
      } else {
        console.warn('Failed to retrieve password, using default');
      }
    }
    
    if (dbHostSecretName) {
      const retrievedDbHost = await getSecret(dbHostSecretName, region);
      if (retrievedDbHost) {
        dbHost = retrievedDbHost;
        console.log(`Using host from secret: ${dbHost}`);
      } else {
        console.warn(`Failed to retrieve host, using default: ${dbHost}`);
      }
    }
    
    if (dbPortSecretName) {
      const retrievedDbPort = await getSecret(dbPortSecretName, region);
      if (retrievedDbPort) {
        dbPort = parseInt(retrievedDbPort, 10);
        console.log(`Using port from secret: ${dbPort}`);
      } else {
        console.warn(`Failed to retrieve port, using default: ${dbPort}`);
      }
    }
    
    console.log(`Database configuration: ${dbName} at ${dbHost}:${dbPort} with user ${dbUser}`);
    
    // Create a temporary .sequelizerc file
    const sequelizeConfig = `
const path = require('path');

module.exports = {
  'config': path.resolve('temp-config', 'database.js'),
  'models-path': path.resolve('models'),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations')
};
    `;
    
    fs.writeFileSync('.sequelizerc', sequelizeConfig);
    console.log('Created .sequelizerc file');
    
    // Check if SSL is required
    const requireSSL = process.env.DB_REQUIRE_SSL === 'true';
    console.log(`SSL requirement for database connection: ${requireSSL ? 'Required' : 'Not required'}`);
    
    // Create a temporary database config file for migrations
    const dbConfig = `
module.exports = {
  development: {
    username: 'devuser',
    password: 'password',
    database: 'devdb',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres'
  },
  test: {
    username: 'devuser',
    password: 'password',
    database: 'devdb',
    host: 'localhost',
    port: 5432,
    dialect: 'postgres'
  },
  production: {
    username: '${dbUser}',
    password: '${dbPassword}',
    database: '${dbName}',
    host: '${dbHost}',
    port: ${dbPort},
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: ${requireSSL ? `{
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }` : '{}'}
  }
};
    `;
    
    // Create a temporary directory for the config if it doesn't exist
    if (!fs.existsSync('temp-config')) {
      fs.mkdirSync('temp-config');
      console.log('Created temp-config directory');
    }
    
    fs.writeFileSync('temp-config/database.js', dbConfig);
    console.log('Created temporary database configuration file');
    
    // Test database connection
    console.log('Testing database connection...');
    const { Sequelize } = require('sequelize');
    const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: 'postgres',
      logging: console.log,
      dialectOptions: requireSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    });
    
    try {
      await sequelize.authenticate();
      console.log('Database connection test successful!');
      return true;
    } catch (connError) {
      console.error('Database connection test failed:', connError.message);
      console.error('Will attempt migrations anyway');
      return true; // Still return true to continue with migrations
    }
  } catch (error) {
    console.error('Failed to retrieve database credentials:', error);
    return false;
  }
}

main()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
EOL

# Run migrations with error handling
echo "===== Running Migrations ====="
echo "Setting NODE_ENV=production"
export NODE_ENV=production

# Check if we're in production mode
if [ "$NODE_ENV" = "production" ]; then
  echo "Production mode detected, retrieving secrets from AWS Secrets Manager"
  
  # Check AWS CLI configuration
  echo "===== AWS Configuration ====="
  aws --version || echo "AWS CLI not installed or not in PATH"
  echo "AWS Region: ${REGION:-us-east-1}"
  
  # Check AWS credentials
  echo "Checking AWS credentials..."
  aws sts get-caller-identity || {
    echo "WARNING: Unable to get AWS identity. This may cause issues with retrieving secrets."
    echo "Make sure AWS credentials are properly configured."
  }
  
  # Install required dependencies if not already installed
  echo "===== Checking Dependencies ====="
  npm list aws-sdk sequelize pg pg-hstore || {
    echo "Installing required dependencies..."
    npm install --no-save aws-sdk sequelize pg pg-hstore
  }
  
  # Run the secret retrieval script
  echo "Running secret retrieval script..."
  node retrieve-secrets.js
  SECRET_RESULT=$?
  
  if [ $SECRET_RESULT -ne 0 ]; then
    echo "Failed to retrieve secrets from AWS Secrets Manager"
    echo "Will attempt to continue with default values"
  fi
  
  # Verify the temporary configuration file exists
  if [ -f "temp-config/database.js" ]; then
    echo "Temporary database configuration file exists"
    echo "Configuration summary (sensitive data masked):"
    node -e "const config = require('./temp-config/database.js').production; console.log({database: config.database, host: config.host, port: config.port, dialect: config.dialect, ssl: config.dialectOptions?.ssl});"
  else
    echo "ERROR: Temporary database configuration file does not exist"
    exit 1
  fi
  
  echo "Running migration command with AWS Secrets Manager credentials..."
  NODE_ENV=production npx sequelize-cli db:migrate --config temp-config/database.js --debug || {
    EXIT_CODE=$?
    echo "Migration failed with error code $EXIT_CODE"
    echo "===== Migration Error Details ====="
    
    # Try to get more information about the database connection
    echo "Testing database connection directly..."
    node -e "
      const config = require('./temp-config/database.js').production;
      const { Sequelize } = require('sequelize');
      console.log('Attempting to connect with:', {
        database: config.database,
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        ssl: config.dialectOptions?.ssl
      });
      
      const sequelize = new Sequelize(
        config.database,
        config.username,
        config.password,
        {
          host: config.host,
          port: config.port,
          dialect: config.dialect,
          logging: console.log,
          dialectOptions: config.dialectOptions
        }
      );
      
      sequelize.authenticate()
        .then(() => {
          console.log('Database connection successful');
          process.exit(0);
        })
        .catch(err => {
          console.error('Database connection error:', err.message);
          process.exit(1);
        });
    "
    
    exit $EXIT_CODE
  }
  
  # Clean up temporary files
  echo "Cleaning up temporary files"
  rm -f .sequelizerc
  rm -rf temp-config
else
  echo "Running migration command with local development credentials..."
  npx sequelize-cli db:migrate || {
    EXIT_CODE=$?
    echo "Migration failed with error code $EXIT_CODE"
    echo "===== Migration Error Details ====="
    echo "Checking if database is accessible..."
    node -e "
    try {
      const config = require('./config/index');
      const { Sequelize } = require('sequelize');
      
      const sequelize = new Sequelize(
        config.database.name,
        config.database.username,
        config.database.password,
        {
          host: config.database.host,
          port: config.database.port,
          dialect: 'postgres',
          logging: console.log
        }
      );
      
      console.log('Attempting to connect to database...');
      sequelize.authenticate()
        .then(() => {
          console.log('Database connection successful');
          process.exit(0);
        })
        .catch(err => {
          console.error('Database connection error:', err.message);
          process.exit(1);
        });
    } catch(e) {
      console.error('Error in connection test script:', e.message);
      process.exit(1);
    }
    "
    exit $EXIT_CODE
  }
fi

echo "===== Database migration completed successfully ====="

# Return to original directory
cd ..
echo "Returned to directory: $(pwd)"

exit 0
