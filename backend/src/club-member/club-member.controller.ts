import { Controller, Post, Body, Req, UsePipes, ValidationPipe, Get, Query } from '@nestjs/common';
import { ClubMemberService } from './club-member.service';
import { JoinClubDto } from './dto/join-club.dto';

@Controller('club-member')
export class ClubMemberController {
  constructor(private readonly clubMemberService: ClubMemberService) {}

  @Post('join')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async join(@Body() joinClubDto: JoinClubDto, @Req() req) {
    const userId = req.user?.id || 3; // Mock userId for demo
    return this.clubMemberService.joinClub(joinClubDto, userId);
  }

  @Get()
  async getMembers(@Query('clubId') clubId: number) {
    return this.clubMemberService.getMembersByClub(Number(clubId));
  }
} 