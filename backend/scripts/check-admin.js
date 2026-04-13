/**
 * Check Admin Status Script
 * 
 * This script checks if the isAdmin property exists and is set correctly
 */

require('dotenv').config({ path: '../.env' });
const { initializeDatabase, User } = require('../models');

async function checkAdminStatus() {
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('Database connection established');
    
    // Get all users
    const users = await User.findAll();
    
    console.log('Total users:', users.length);
    
    // Check each user's admin status
    users.forEach(user => {
      console.log(`User: ${user.email}`);
      console.log(`  isAdmin: ${user.isAdmin}`);
      console.log(`  isAdmin type: ${typeof user.isAdmin}`);
      console.log(`  Raw data:`, user.get({ plain: true }));
      console.log('-------------------');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking admin status:', error);
    process.exit(1);
  }
}

checkAdminStatus();
