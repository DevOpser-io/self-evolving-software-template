#!/usr/bin/env node

/**
 * Test rollback script for development
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple config for development
const config = {
  development: {
    username: process.env.DB_USER || 'devuser',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'devdb',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  }
};

// Create config directory if it doesn't exist
const configDir = path.resolve(__dirname, '../config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write config.json
const configPath = path.join(configDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Config written to:', configPath);

// Run rollback
console.log('\n=== Running migration rollback ===');
const result = spawnSync('npx', ['sequelize-cli', 'db:migrate:undo'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development'
  },
  cwd: path.resolve(__dirname, '..')
});

if (result.status === 0) {
  console.log('\nRollback completed successfully');
} else {
  console.error(`\nRollback failed with exit code ${result.status}`);
  process.exit(result.status);
}