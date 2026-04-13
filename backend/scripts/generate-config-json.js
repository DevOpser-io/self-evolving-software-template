/**
 * Script to generate a config.json file from our database.js configuration
 * This ensures Sequelize CLI can find the configuration in Kubernetes
 */
const fs = require('fs');
const path = require('path');

// Set NODE_ENV to production
process.env.NODE_ENV = 'production';

// Import the database configuration
const databaseConfig = require('../config/database');

// Create the config directory if it doesn't exist
const configDir = path.resolve(__dirname, '../config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write the configuration to config.json
const configPath = path.resolve(configDir, 'config.json');
fs.writeFileSync(
  configPath,
  JSON.stringify(databaseConfig, null, 2)
);

console.log(`Generated config.json at ${configPath}`);
console.log('Configuration:', {
  ...databaseConfig.production,
  password: '***MASKED***'
});
