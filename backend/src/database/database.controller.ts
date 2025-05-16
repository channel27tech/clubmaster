import { Controller, Get } from '@nestjs/common';
import { DatabaseTestService } from './database-test.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseTestService: DatabaseTestService) {}

  @Get('test')
  async testConnection() {
    return this.databaseTestService.testConnection();
  }
} 