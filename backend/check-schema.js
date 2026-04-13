const { sequelize } = require('./models');

async function checkSchema() {
  try {
    // Check Users table schema
    const [usersSchema] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Users table schema:');
    console.log(usersSchema);
    
    // Check users table schema
    const [usersLowercaseSchema] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nusers table schema:');
    console.log(usersLowercaseSchema);
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking schema:', error);
    process.exit(1);
  }
}

checkSchema();
