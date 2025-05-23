import { Controller, Get, Param, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ProfileDataService } from './profile-data.service';

@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly profileDataService: ProfileDataService) {}

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
