import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables from .env file
dotenv.config();

// Log environment variables for debugging
console.log('Database Environment Variables:');
console.log(`DB_HOST: ${process.env.DB_HOST}`);
console.log(`DB_PORT: ${process.env.DB_PORT}`);
console.log(`DB_USERNAME: ${process.env.DB_USERNAME}`);
console.log(`DB_DATABASE: ${process.env.DB_DATABASE}`);
console.log(`DB_SCHEMA: ${process.env.DB_SCHEMA}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
// Password is sensitive, so just log if it's defined
console.log(`DB_PASSWORD defined: ${process.env.DB_PASSWORD ? 'Yes' : 'No'}`);

const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_DATABASE || 'clubmaster_new',
  schema: process.env.DB_SCHEMA || 'public',
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
  synchronize: process.env.NODE_ENV === 'development', // Auto-create database schema in development
  logging: ['error', 'query', 'schema'], // Enhanced logging for debugging
  // SSL configuration for production environments (like Heroku)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

export default databaseConfig; 