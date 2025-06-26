import { Controller, Get, Post, Body, Param, Put, Delete, NotFoundException, Logger, Headers, UnauthorizedException, UseGuards, Req, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { SyncUserDto } from './dto/sync-user.dto';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';
import * as admin from 'firebase-admin';
import { Request } from 'express';

// Extend the Express Request interface to include our firebaseUser property
interface FirebaseRequest extends Request {
  firebaseUser: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
  };
  user: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
  };
}

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get('list')
  @UseGuards(FirebaseAuthGuard)
  async listUsers(
    @Req() req: FirebaseRequest,
    @Query('excludeClubMembers') excludeClubMembers?: string
  ): Promise<User[]> {
    const currentUserId = req.user.uid; // This line will now have req.user defined
    const exclude = excludeClubMembers === 'true';
    return this.usersService.findAllExcludingClubMembers(exclude, currentUserId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Post()
  async create(@Body() userData: Partial<User>): Promise<User> {
    this.logger.log(`Creating new user with email: ${userData.email}`);
    return this.usersService.create(userData);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() userData: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, userData);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.usersService.remove(id);
    return { message: `User with ID ${id} has been deleted` };
  }

  // Profile endpoint to get user profile data
  @Get('profile/:id')
  async getProfile(@Param('id') id: string): Promise<any> {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException(`User profile with ID ${id} not found`);
    }
    // Determine if profile is under control
    let displayName = user.displayName;
    let photoURL = user.photoURL;
    const now = new Date();
    if (
      user.profileControlledBy &&
      user.profileControlExpiry &&
      new Date(user.profileControlExpiry) > now
    ) {
      if (user.controlledNickname) displayName = user.controlledNickname;
      if (user.controlledAvatarType) photoURL = user.controlledAvatarType; // If you need to map avatarType to a URL, do it here
    }
    return {
      id: user.id,
      displayName,
      email: user.email,
      photoURL,
      rating: user.rating,
      stats: {
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        gamesLost: user.gamesLost,
        gamesDraw: user.gamesDraw,
        winRate: user.gamesPlayed > 0 
          ? Math.round((user.gamesWon / user.gamesPlayed) * 100) 
          : 0
      }
    };
  }

  /**
   * Sync Firebase user data to PostgreSQL
   * Expects a Bearer token containing a Firebase ID token
   * Extracts the UID from the token and updates/creates the user record
   */
  @Post('sync')
  @UseGuards(FirebaseAuthGuard)
  async syncFirebaseUser(
    @Req() req: FirebaseRequest,
    @Body() userData: SyncUserDto
  ): Promise<User> {
    try {
      const firebaseUid = req.user.uid; // Using the request.user property set by FirebaseAuthGuard
      
      this.logger.log(`🛂 Processing Firebase sync for UID: ${firebaseUid.substring(0, 6)}...`);
      this.logger.log(`📥 Received data: ${JSON.stringify({
        displayName: userData.displayName || '(none)',
        email: userData.email ? `${userData.email.substring(0, 3)}...` : '(none)',
        hasPhoto: !!userData.photoURL,
        hasPhone: !!userData.phoneNumber,
        isAnonymous: userData.isAnonymous || false
      })}`);
      
      // Combine incoming DTO with Firebase claims from token
      const enrichedUserData: SyncUserDto = {
        ...userData,
        // If these are blank in userData but available in token claims, use from token
        displayName: userData.displayName || req.user.displayName,
        email: userData.email || req.user.email,
        photoURL: userData.photoURL || req.user.photoURL,
        phoneNumber: userData.phoneNumber || req.user.phoneNumber,
      };
      
      // Use the service method to handle all the logic
      const user = await this.usersService.syncUser(firebaseUid, enrichedUserData);
      
      return user;
    } catch (error) {
      this.logger.error(`❌ Error syncing Firebase user: ${error.message}`, error.stack);
      throw error;
    }
  }
} 