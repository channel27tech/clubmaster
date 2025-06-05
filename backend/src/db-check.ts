import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a new database connection
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'clubmaster_new',
});

async function checkDatabase() {
  try {
    // Initialize the connection
    await dataSource.initialize();
    console.log('Database connection established');

    // Check tables in the database
    const tables = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in database:', tables.map(t => t.table_name));

    // Check specifically for notifications table
    const notificationsExists = tables.some(t => t.table_name === 'notifications');
    console.log('Notifications table exists:', notificationsExists);

    if (notificationsExists) {
      // Get column details for notifications table
      const columns = await dataSource.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'notifications'
        ORDER BY ordinal_position
      `);
      console.log('Notifications table columns:', columns);

      // Count records in notifications table
      const count = await dataSource.query('SELECT COUNT(*) FROM notifications');
      console.log('Number of notifications:', count[0].count);
    }

    // Check enum types
    const enumTypes = await dataSource.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `);
    console.log('Enum types:', enumTypes);

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    // Close the connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run the check
checkDatabase(); 