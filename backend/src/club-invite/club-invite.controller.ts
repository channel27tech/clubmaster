import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ClubInviteService } from './club-invite.service';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';

@Controller('club-invite')
export class ClubInviteController {
  constructor(private readonly inviteService: ClubInviteService) {}

  @Post('create')
  @UseGuards(FirebaseAuthGuard)
  async create(@Body() body: { clubId: number }, @Req() req) {
    // TODO: Add logic to check if req.user is super admin of the club
    return this.inviteService.createInvite(body.clubId, req.user.uid);
  }
} 