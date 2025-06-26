import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../game/entities/game.entity';
import { processBase64Image } from '../utils/imageProcessor';

// Define DTO for profile update
export interface UpdateProfileDto {
  username?: string;
  first_name?: string | null;
  last_name?: string | null;
  location?: string | null;
  custom_photo_base64?: string | null;
}

@Injectable()
export class ProfileDataService {
  private readonly logger = new Logger(ProfileDataService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

  /**
   * Get user profile data including rating and game statistics
   * @param firebaseUid Firebase User ID to fetch profile for
   * @returns User profile data
   * @throws NotFoundException if user not found
   */
  async getUserProfile(firebaseUid: string) {
    this.logger.log(`Fetching profile for Firebase UID: ${firebaseUid}`);
    
    try {
      // Find user by Firebase UID
      const user = await this.usersRepository.findOne({
        where: { firebaseUid },
        select: [
          'id',
          'displayName',
          'photoURL',
          'rating',
          'gamesPlayed',
          'gamesWon',
          'gamesLost',
          'gamesDraw',
          'username',
          'first_name',
          'last_name',
          'location',
          'custom_photo_base64',
          'profileControlledBy',
          'profileControlExpiry',
          'profileLocked',
          'profileLockExpiry',
          'controlledNickname',
          'controlledAvatarType',
        ],
      });

      if (!user) {
        this.logger.warn(`User with Firebase UID ${firebaseUid} not found`);
        throw new NotFoundException(`User not found for Firebase UID: ${firebaseUid}`);
      }

      this.logger.log(`Successfully resolved Firebase UID ${firebaseUid} to user ID ${user.id}`);
      this.logger.log(`Fetched profile for user ${user.displayName} with rating ${user.rating}`);
      
      // Create a property that combines custom_photo_base64 and photoURL
      const effective_photo_url = user.custom_photo_base64 || user.photoURL;
      
      return {
        id: user.id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        gamesLost: user.gamesLost,
        gamesDraw: user.gamesDraw,
        firebaseUid: firebaseUid,
        username: user.username || user.displayName, // Fallback to displayName if username is not set
        first_name: user.first_name,
        last_name: user.last_name,
        location: user.location,
        custom_photo_base64: user.custom_photo_base64,
        effective_photo_url: effective_photo_url, // Combined field for UI to use
        profileControlledBy: user.profileControlledBy,
        profileControlExpiry: user.profileControlExpiry,
        profileLocked: user.profileLocked,
        profileLockExpiry: user.profileLockExpiry,
        controlledNickname: user.controlledNickname,
        controlledAvatarType: user.controlledAvatarType,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw NotFoundException to be handled by controller
      }
      this.logger.error(`Error fetching user profile: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param firebaseUid Firebase User ID
   * @param updateData Profile data to update
   * @returns Updated user profile
   */
  async updateUserProfile(firebaseUid: string, updateData: UpdateProfileDto) {
    this.logger.log(`Updating profile for Firebase UID: ${firebaseUid}`);
    
    try {
      // Find user by Firebase UID
      const user = await this.usersRepository.findOne({
        where: { firebaseUid },
      });

      if (!user) {
        this.logger.warn(`User with Firebase UID ${firebaseUid} not found`);
        throw new NotFoundException(`User not found for Firebase UID: ${firebaseUid}`);
      }

      // Check username availability if it's being updated
      if (updateData.username && updateData.username !== user.username) {
        const isUsernameAvailable = await this.isUsernameAvailable(updateData.username);
        if (!isUsernameAvailable) {
          throw new ConflictException(`Username "${updateData.username}" is already taken`);
        }
      }

      // Process the profile picture if provided
      if (updateData.custom_photo_base64) {
        const processedImage = processBase64Image(updateData.custom_photo_base64);
        if (!processedImage) {
          throw new BadRequestException('Invalid image format. Please provide a valid image.');
        }
        updateData.custom_photo_base64 = processedImage;
      }

      // Update user data
      Object.assign(user, {
        username: updateData.username || user.username || user.displayName,
        first_name: updateData.first_name !== undefined ? updateData.first_name : user.first_name,
        last_name: updateData.last_name !== undefined ? updateData.last_name : user.last_name,
        location: updateData.location !== undefined ? updateData.location : user.location,
        custom_photo_base64: updateData.custom_photo_base64 !== undefined ? updateData.custom_photo_base64 : user.custom_photo_base64,
      });

      // Save the updated user
      await this.usersRepository.save(user);
      this.logger.log(`Successfully updated profile for user ${user.id}`);

      // Return the updated profile
      return this.getUserProfile(firebaseUid);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error; // Re-throw specific exceptions to be handled by controller
      }
      this.logger.error(`Error updating user profile: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if a username is available
   * @param username The username to check
   * @param excludeFirebaseUid Optionally exclude a user by Firebase UID (for self-updates)
   * @returns Boolean indicating if the username is available
   */
  async isUsernameAvailable(username: string, excludeFirebaseUid?: string): Promise<boolean> {
    this.logger.log(`Checking username availability: ${username}`);
    
    const query = this.usersRepository.createQueryBuilder('user')
      .where('user.username = :username', { username });
    
    if (excludeFirebaseUid) {
      query.andWhere('user.firebaseUid != :firebaseUid', { firebaseUid: excludeFirebaseUid });
    }
    
    const count = await query.getCount();
    const isAvailable = count === 0;
    
    this.logger.log(`Username "${username}" is ${isAvailable ? 'available' : 'not available'}`);
    return isAvailable;
  }

  /**
   * Get game history for a specific user
   * @param firebaseUid Firebase User ID to fetch game history for
   * @returns Array of game history entries
   * @throws NotFoundException if user not found
   */
  async getGameHistory(firebaseUid: string) {
    this.logger.log(`Fetching game history for Firebase UID: ${firebaseUid}`);
    
    try {
      // First, find the user by Firebase UID
      const user = await this.usersRepository.findOne({
        where: { firebaseUid },
        select: ['id', 'displayName']
      });

      if (!user) {
        this.logger.warn(`User with Firebase UID ${firebaseUid} not found`);
        throw new NotFoundException(`User not found for Firebase UID: ${firebaseUid}`);
      }

      const userId = user.id;
      this.logger.log(`Successfully resolved Firebase UID ${firebaseUid} to user ID ${userId}`);

      // Find games where the user is either white or black player
      const games = await this.gamesRepository
        .createQueryBuilder('game')
        .leftJoinAndSelect('game.whitePlayer', 'whitePlayer')
        .leftJoinAndSelect('game.blackPlayer', 'blackPlayer')
        .leftJoinAndSelect('game.winner', 'winner')
        .where('game.whitePlayerId = :userId', { userId })
        .orWhere('game.blackPlayerId = :userId', { userId })
        .orderBy('game.createdAt', 'DESC')
        .getMany();

      this.logger.log(`Found ${games.length} games for user ID: ${userId}`);
      
      // Format the game history entries
      const gameHistory = games.map(game => {
        // Determine if the user was white or black
        const isWhite = game.whitePlayerId === userId;
        const opponentId = isWhite ? game.blackPlayerId : game.whitePlayerId;
        const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
        const opponentName = opponent?.displayName || 'Unknown Player';
        const opponentRating = isWhite ? game.blackPlayerRating : game.whitePlayerRating;
        
        // Determine the result for this user
        let result: string;
        if (game.status === 'ongoing') {
          result = 'Ongoing';
        } else if (game.status === 'aborted') {
          result = 'Aborted';
        } else if (game.status === 'draw') {
          result = 'Draw';
        } else if (
          (game.status === 'white_win' && isWhite) || 
          (game.status === 'black_win' && !isWhite)
        ) {
          result = 'Win';
        } else {
          result = 'Loss';
        }
        
        return {
          id: game.id,
          gameId: game.id,
          opponent: {
            id: opponentId,
            name: opponentName,
          },
          opponentId,
          opponentName,
          opponentRating,
          result,
          endReason: game.endReason,
          resultReason: game.endReason,
          timeControl: game.timeControl,
          moveCount: game.totalMoves,
          date: game.createdAt,
          status: game.status,
          userColor: isWhite ? 'white' : 'black',
          rated: game.rated,
          whitePlayerRating: game.whitePlayerRating,
          blackPlayerRating: game.blackPlayerRating,
          whitePlayerRatingAfter: game.whitePlayerRatingAfter,
          blackPlayerRatingAfter: game.blackPlayerRatingAfter,
          winnerId: game.winnerId,
          userId: userId, // Include the resolved user ID for reference
        };
      });

      return gameHistory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw NotFoundException to be handled by controller
      }
      this.logger.error(`Error fetching game history: ${error.message}`, error.stack);
      throw error;
    }
  }
}
