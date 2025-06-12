import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubInviteController } from './club-invite.controller';
import { ClubInviteService } from './club-invite.service';
import { ClubInvite } from './club-invite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClubInvite])],
  controllers: [ClubInviteController],
  providers: [ClubInviteService],
  exports: [ClubInviteService],
})
export class ClubInviteModule {} 