import { Controller, Post, Body, Req, UsePipes, ValidationPipe, Get, Query, UseGuards, UnauthorizedException, NotFoundException, Param, Request, ForbiddenException } from '@nestjs/common';
import { ClubMemberService } from './club-member.service';
import { JoinClubDto } from './dto/join-club.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Club } from '../club/club.entity';

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
  constructor(
    private readonly clubMemberService: ClubMemberService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
  ) {}

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
    const user = await this.userRepository.findOne({ where: { firebaseUid: req.user.uid } });
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

  @Post('/club/:clubId/leave')
  @UseGuards(FirebaseAuthGuard)
  async leaveClub(
    @Param('clubId') clubId: string,
    @Request() req
  ) {
    const user = await this.userRepository.findOne({ where: { firebaseUid: req.user.uid } });
    if (!user) throw new UnauthorizedException('User not found');
    
    await this.clubMemberService.leaveClub(user.id, clubId);
    return { success: true };
  }

  @Post('/club/:clubId/remove/:userId')
  @UseGuards(FirebaseAuthGuard)
  async removeMemberFromClub(
    @Param('clubId') clubId: string,
    @Param('userId') userId: string,
    @Request() req
  ) {
    // Find the club and check if requester is super admin
    const club = await this.clubRepository.findOne({ where: { id: parseInt(clubId, 10) } });
    if (!club) throw new NotFoundException('Club not found');
    const requester = await this.userRepository.findOne({ where: { firebaseUid: req.user.uid } });
    if (!requester || club.superAdminId !== requester.id) throw new ForbiddenException('Only super admin can remove members');
    // Remove the member
    await this.clubMemberService.removeMember(userId, clubId);
    return { success: true };
  }

  @Post('club/:clubId/transfer-super-admin')
  @UseGuards(FirebaseAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async transferSuperAdmin(
    @Param('clubId') clubId: string,
    @Body() body: { toUserId: string },
    @Request() req
  ) {
    const club = await this.clubRepository.findOne({ where: { id: parseInt(clubId, 10) } });
    if (!club) throw new NotFoundException('Club not found');
    const requester = await this.userRepository.findOne({ where: { firebaseUid: req.user.uid } });
    if (!requester) throw new UnauthorizedException('User not found');
    await this.clubMemberService.transferSuperAdmin(requester.id, body.toUserId, clubId);
    return { success: true };
  }
} 