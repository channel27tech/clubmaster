import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserActivityService } from './user-activity.service';
import { FriendNotificationHelper } from './friend-notification.helper';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    NotificationsModule,
  ],
  providers: [
    UsersService, 
    UserActivityService,
    FriendNotificationHelper,
  ],
  controllers: [UsersController],
  exports: [UsersService, UserActivityService, FriendNotificationHelper],
})
export class UsersModule {} 