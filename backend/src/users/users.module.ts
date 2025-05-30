import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UserActivityService],
  controllers: [UsersController],
  exports: [UsersService, UserActivityService],
})
export class UsersModule {} 