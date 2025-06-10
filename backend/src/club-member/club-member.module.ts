import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubMember } from './club-member.entity';
import { Club } from '../club/club.entity';
import { ClubMemberController } from './club-member.controller';
import { ClubMemberService } from './club-member.service';
import { User } from '../users/entities/user.entity';
import { ClubInviteModule } from '../club-invite/club-invite.module';

@Module({
  imports: [TypeOrmModule.forFeature([ClubMember, Club, User]), ClubInviteModule],
  controllers: [ClubMemberController],
  providers: [ClubMemberService],
  exports: [ClubMemberService],
})
export class ClubMemberModule {} 