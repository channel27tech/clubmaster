import { Controller, Post, Body, Req, UsePipes, ValidationPipe, Get, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ClubMemberService } from './club-member.service';
import { JoinClubDto } from './dto/join-club.dto';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';

// Extend the Express Request interface to include our firebaseUser property
interface FirebaseRequest extends Request {
  user: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
  };
}

@Controller('club-member')
export class ClubMemberController {
  constructor(private readonly clubMemberService: ClubMemberService) {}

  @Post('join')
  @UseGuards(FirebaseAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async join(@Body() joinClubDto: JoinClubDto, @Req() req: FirebaseRequest) {
    if (!req.user || !req.user.uid) {
      throw new UnauthorizedException('User authentication required');
    }
    
    return this.clubMemberService.joinClub(joinClubDto, req.user.uid);
  }

  @Get()
  async getMembers(@Query('clubId') clubId: number) {
    return this.clubMemberService.getMembersByClub(Number(clubId));
  }

  @Get('my')
  @UseGuards(FirebaseAuthGuard)
  async getMyClub(@Req() req: FirebaseRequest) {
    if (!req.user || !req.user.uid) {
      throw new UnauthorizedException('User authentication required');
    }
    // Debug logging
    console.log('Firebase UID:', req.user.uid);
    const user = await this.clubMemberService['userRepository'].findOne({ where: { firebaseUid: req.user.uid } });
    console.log('User:', user);
    if (!user) return null;
    // Find club membership
    const membership = await this.clubMemberService['clubMemberRepository'].findOne({ where: { userId: user.id } });
    console.log('Membership:', membership);
    if (!membership) return null;
    // Find club
    const club = await this.clubMemberService['clubRepository'].findOne({ where: { id: membership.clubId } });
    return {
      club,
      role: membership.role,
    };
  }
} 