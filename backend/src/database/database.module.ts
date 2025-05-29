import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';
import { DatabaseTestService } from './database-test.service';
import { DatabaseController } from './database.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
  ],
  providers: [DatabaseTestService],
  controllers: [DatabaseController],
  exports: [DatabaseTestService],
})
export class DatabaseModule {} 