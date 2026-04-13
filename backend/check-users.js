const { sequelize, User } = require('./models');

async function checkUsers() {
  try {
    // Check if users table exists
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in database:');
    console.log(tables);
    
    // Check users table name (case-sensitive)
    const [userTable] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%user%'
    `);
    
    console.log('\nUser-related tables:');
    console.log(userTable);
    
    // Check user with ID 2
    const user = await User.findByPk(2);
    console.log('\nUser with ID 2:');
    console.log(user ? `Found: ${user.email}` : 'Not found');
    
    // Check all users
    const users = await User.findAll();
    console.log('\nAll users:');
    users.forEach(u => console.log(`ID: ${u.id}, Email: ${u.email}`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  }
}

checkUsers();
