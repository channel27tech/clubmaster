import { 
  Controller, 
  Get, 
  Post, 
  Patch,
  Body, 
  Param, 
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Headers,
  Request
} from '@nestjs/common';
import { BetService } from './bet.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { BetType } from './bet.model';
import { IsOptional, IsString } from 'class-validator';
import { UsersService } from '../users/users.service';

// DTO for profile control update
class ProfileControlUpdateDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarType?: string;
}

@Controller('bet')
export class BetController {
  private readonly logger = new Logger('BET');
  
  constructor(
    private readonly betService: BetService,
    private readonly usersService: UsersService
  ) {}
  
  @Patch('profile-control')
  @UseGuards(FirebaseAuthGuard)
  async updateProfileControl(
    @Request() req,
    @Body() updateData: ProfileControlUpdateDto,
    @Query('targetUserId') targetUserId: string
  ) {
    const firebaseUid = req.user.uid;
    // Map Firebase UID to internal user UUID
    const controllerUser = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!controllerUser) {
      throw new UnauthorizedException('User not found');
    }
    const controllerId = controllerUser.id;
    this.logger.log(`User ${controllerId} (firebaseUid: ${firebaseUid}) attempting to update profile of user ${targetUserId}`);
    
    // Validate the request
    if (!targetUserId) {
      throw new BadRequestException('Target user ID is required');
    }

    // Check if the controlling user has permission to update this profile
    const hasControl = await this.betService.checkProfileControl(controllerId, targetUserId);
    
    if (!hasControl) {
      throw new UnauthorizedException('You do not have permission to control this profile');
    }
    
    // Apply the profile control changes
    const result = await this.betService.applyProfileControlChanges(
      targetUserId, 
      updateData.nickname, 
      updateData.avatarType
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: result
    };
  }

  @Get('profile-control/check')
  @UseGuards(FirebaseAuthGuard)
  async checkProfileControl(
    @Request() req,
    @Query('targetUserId') targetUserId: string
  ) {
    const firebaseUid = req.user.uid;
    // Map Firebase UID to internal user UUID
    const controllerUser = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!controllerUser) {
      throw new UnauthorizedException('User not found');
    }
    const userId = controllerUser.id;
    if (!targetUserId) {
      throw new BadRequestException('Target user ID is required');
    }
    
    const hasControl = await this.betService.checkProfileControl(userId, targetUserId);
    const controlDetails = await this.betService.getProfileControlDetails(targetUserId);
    
    return {
      hasControl,
      controlDetails
    };
  }

  @Get('profile-lock/status')
  @UseGuards(FirebaseAuthGuard)
  async checkProfileLockStatus(@Headers('user_id') userId: string) {
    const lockStatus = await this.betService.checkProfileLockStatus(userId);
    
    return {
      isLocked: lockStatus.isLocked,
      expiresAt: lockStatus.expiresAt
    };
  }
} 