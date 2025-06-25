import { Controller, Get, Post, Body, Param, Logger, NotFoundException, HttpException, HttpStatus, ConflictException, BadRequestException, UseGuards, Headers } from '@nestjs/common';
import { Response } from 'express';
import { ProfileDataService, UpdateProfileDto } from './profile-data.service';
import * as admin from 'firebase-admin';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';

@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly profileDataService: ProfileDataService) {}

  /**
   * Get current user profile data using firebase auth token
   * @returns User profile data
   */
  @Get()
  @UseGuards(FirebaseAuthGuard)
  async getCurrentUserProfile(@Headers('authorization') authorization: string) {
    try {
      if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new HttpException('Invalid authorization header', HttpStatus.UNAUTHORIZED);
      }
      
      const idToken = authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      
      this.logger.log(`Fetching profile for current user with Firebase UID: ${firebaseUid}`);
      
      const userProfile = await this.profileDataService.getUserProfile(firebaseUid);
      this.logger.log(`Successfully fetched profile data for current user`);
      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      this.logger.error(`Error fetching profile for current user: ${error.message}`);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get user profile data
   * @param userId Firebase User ID to fetch profile for
   * @returns User profile data
   */
  @Get(':userId')
  async getUserProfile(@Param('userId') firebaseUid: string) {
    this.logger.log(`Received request for user profile with Firebase UID: ${firebaseUid}`);
    try {
      const userProfile = await this.profileDataService.getUserProfile(firebaseUid);
      this.logger.log(`Successfully fetched profile data for Firebase UID: ${firebaseUid}`);
      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`User not found for Firebase UID: ${firebaseUid}`);
        throw new NotFoundException(error.message);
      }
      this.logger.error(`Error fetching profile for Firebase UID ${firebaseUid}: ${error.message}`);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update user profile
   * @param firebaseUid Firebase User ID from auth token
   * @param updateProfileDto Profile data to update
   * @returns Updated user profile
   */
  @Post('update')
  @UseGuards(FirebaseAuthGuard)
  async updateProfile(@Headers('authorization') authorization: string, @Body() updateProfileDto: UpdateProfileDto) {
    try {
      if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new HttpException('Invalid authorization header', HttpStatus.UNAUTHORIZED);
      }
      
      const idToken = authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;
      
      this.logger.log(`Received profile update request for Firebase UID: ${firebaseUid}`);
      
      // Validate inputs
      if (updateProfileDto.username && (typeof updateProfileDto.username !== 'string' || updateProfileDto.username.trim() === '')) {
        throw new BadRequestException('Username must be a non-empty string');
      }
      
      // Sanitize inputs
      if (updateProfileDto.username) {
        updateProfileDto.username = updateProfileDto.username.trim();
      }
      
      const updatedProfile = await this.profileDataService.updateUserProfile(firebaseUid, updateProfileDto);
      
      this.logger.log(`Successfully updated profile for Firebase UID: ${firebaseUid}`);
      return {
        message: 'Profile updated successfully',
        user: updatedProfile
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException(error.message);
      } else if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Error updating profile: ${error.message}`, error.stack);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get user's game history
   * @param userId Firebase User ID to fetch game history for
   * @returns Array of game history entries
   */
  @Get(':userId/games')
  async getGameHistory(@Param('userId') firebaseUid: string) {
    this.logger.log(`Received request for game history with Firebase UID: ${firebaseUid}`);
    try {
      const gameHistory = await this.profileDataService.getGameHistory(firebaseUid);
      this.logger.log(`Successfully fetched game history for Firebase UID: ${firebaseUid}, found ${gameHistory.length} games`);
      return gameHistory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(`User not found for Firebase UID: ${firebaseUid}`);
        throw new NotFoundException(error.message);
      }
      this.logger.error(`Error fetching game history for Firebase UID ${firebaseUid}: ${error.message}`);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
