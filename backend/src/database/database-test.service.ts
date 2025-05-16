import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseTestService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseTestService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      // Test the database connection
      const result = await this.dataSource.query('SELECT 1 as connected');
      this.logger.log(`Database connection successful: ${JSON.stringify(result)}`);
      
      // Get list of tables
      const tables = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
      `, [process.env.DB_SCHEMA || 'public']);
      
      this.logger.log(`Tables in database: ${tables.map(t => t.table_name).join(', ') || 'No tables found'}`);
    } catch (error) {
      this.logger.error(`Database connection test failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.dataSource.query('SELECT NOW() as timestamp');
      return { 
        success: true, 
        timestamp: result[0].timestamp,
        message: 'Database connection is working correctly'
      };
    } catch (error) {
      this.logger.error(`Database connection test failed: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }
} 