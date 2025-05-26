import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Club } from './club.entity';
import { ClubController } from './club.controller';
import { ClubService } from './club.service';
import { User } from '../users/entities/user.entity';
import { ClubMember } from '../club-member/club-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Club, User, ClubMember])],
  controllers: [ClubController],
  providers: [ClubService],
  exports: [ClubService],
})
export class ClubModule {} 