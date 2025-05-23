import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../game/entities/game.entity';

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
        ],
      });

      if (!user) {
        this.logger.warn(`User with Firebase UID ${firebaseUid} not found`);
        throw new NotFoundException(`User not found for Firebase UID: ${firebaseUid}`);
      }

      this.logger.log(`Successfully resolved Firebase UID ${firebaseUid} to user ID ${user.id}`);
      this.logger.log(`Fetched profile for user ${user.displayName} with rating ${user.rating}`);
      
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
