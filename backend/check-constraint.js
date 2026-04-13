const { sequelize } = require('./models');

async function checkConstraint() {
  try {
    const [results] = await sequelize.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'conversations'
        AND kcu.column_name = 'user_id';
    `);

    console.log('Foreign Key Constraint Details:');
    console.log(results);

    process.exit(0);
  } catch (error) {
    console.error('Error checking constraint:', error);
    process.exit(1);
  }
}

checkConstraint();
