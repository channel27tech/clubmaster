import { Controller, Post, Patch, Get, Body, Param, UseGuards, Request, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto, FriendResponseDto } from './dto';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';

@ApiTags('friends')
@Controller('friends')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  private readonly logger = new Logger(FriendsController.name);

  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Friend request already exists' })
  async sendFriendRequest(
    @Request() req,
    @Body() sendFriendRequestDto: SendFriendRequestDto,
  ) {
    this.logger.log(`User ${req.user.uid} is sending a friend request to ${sendFriendRequestDto.friendId}`);
    await this.friendsService.sendFriendRequest(req.user.uid, sendFriendRequestDto.friendId);
    return { message: 'Friend request sent successfully' };
  }

  @Patch('accept/:notificationId')
  @ApiOperation({ summary: 'Accept a friend request' })
  @ApiResponse({ status: 200, description: 'Friend request accepted successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async acceptFriendRequest(
    @Request() req,
    @Param('notificationId') notificationId: string,
  ) {
    this.logger.log(`User ${req.user.uid} is accepting friend request notification: ${notificationId}`);
    await this.friendsService.acceptFriendRequest(req.user.uid, notificationId);
    return { message: 'Friend request accepted successfully' };
  }

  @Patch('reject/:notificationId')
  @ApiOperation({ summary: 'Reject a friend request' })
  @ApiResponse({ status: 200, description: 'Friend request rejected successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async rejectFriendRequest(
    @Request() req,
    @Param('notificationId') notificationId: string,
  ) {
    this.logger.log(`User ${req.user.uid} is rejecting friend request notification: ${notificationId}`);
    await this.friendsService.rejectFriendRequest(req.user.uid, notificationId);
    return { message: 'Friend request rejected successfully' };
  }

  @Get()
  @ApiOperation({ summary: 'Get current user\'s friends list' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the list of friends', 
    type: [FriendResponseDto] 
  })
  async getFriends(@Request() req): Promise<FriendResponseDto[]> {
    this.logger.log(`Getting friends list for user: ${req.user.uid}`);
    return this.friendsService.getFriends(req.user.uid);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if users are friends' })
  @ApiResponse({ status: 200, description: 'Returns friendship status' })
  async checkFriendship(
    @Request() req,
    @Query('friendId') friendId: string,
  ) {
    this.logger.log(`User ${req.user.uid} is checking friendship with ${friendId}`);
    const areFriends = await this.friendsService.isFriends(req.user.uid, friendId);
    return { areFriends };
  }

  @Get('pending')
  @ApiOperation({ summary: 'Check if there is a pending friend request between users' })
  @ApiResponse({ status: 200, description: 'Returns pending request status' })
  async checkPendingRequest(
    @Request() req,
    @Query('friendId') friendId: string,
  ) {
    this.logger.log(`User ${req.user.uid} is checking pending request with ${friendId}`);
    const isPending = await this.friendsService.checkPendingRequest(req.user.uid, friendId);
    return { isPending };
  }
} 