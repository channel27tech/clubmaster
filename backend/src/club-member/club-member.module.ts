import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubMember } from './club-member.entity';
import { ClubMemberService } from './club-member.service';
import { ClubMemberController } from './club-member.controller';
import { ClubModule } from '../club/club.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Club } from '../club/club.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClubMember, Club, User]),
    ClubModule,
    NotificationsModule,
  ],
  controllers: [ClubMemberController],
  providers: [ClubMemberService],
  exports: [ClubMemberService],
})
export class ClubMemberModule {} 