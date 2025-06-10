import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Club } from './club.entity';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { User } from '../users/entities/user.entity';
import { ClubMember } from '../club-member/club-member.entity';
import { ClubNotificationHelper } from './club-notification.helper';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Club, User, ClubMember]),
    NotificationsModule,
  ],
  controllers: [ClubController],
  providers: [
    ClubService,
    ClubNotificationHelper,
  ],
  exports: [ClubService, ClubNotificationHelper],
})
export class ClubModule {} 