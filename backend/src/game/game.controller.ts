import { Controller, Get, Param, UseGuards, NotFoundException, Logger } from '@nestjs/common';
import { GameRepositoryService } from './game-repository.service';
import { UsersService } from '../users/users.service';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';
import { Game } from './entities/game.entity';

@Controller('games')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':id/players')
  @UseGuards(FirebaseAuthGuard)
  async getGamePlayers(@Param('id') id: string) {
    this.logger.log(`Received request for game players with ID: ${id}`);
    
    // Check if this might be a bet game (often has a UUID format)
    const isBetGameByFormat = id.length >= 32 && id.includes('-');
    if (isBetGameByFormat) {
      this.logger.log(`ID format suggests this might be a bet game: ${id}`);
    }
   
    // Use the customId-aware lookup with multiple fallback strategies
    try {
      const game = await this.gameRepositoryService.findOneByCustomId(id);
      if (!game) {
        // Try by the direct ID as a last resort
        const gameById = await this.gameRepositoryService.findOne(id);
        if (!gameById) {
          this.logger.error(`Game with ID ${id} not found using any lookup method`);
          throw new NotFoundException(`Game with ID ${id} not found`);
        } else {
          this.logger.log(`[GameController] Found game by direct ID lookup ${id}: ${gameById.id}`);
          // Continue with the found game
          return this.buildPlayerResponse(gameById, id);
        }
      }
      
      this.logger.log(`[GameController] Found game for customId ${id}: ${game.id}`);
      
      // Check for bet game metadata in endReason
      const endReason = game.endReason || '';
      const isBetGame = endReason.startsWith('bet:');
      if (isBetGame) {
        // Extract bet type if possible
        const betParts = endReason.split(':');
        const betType = betParts.length > 1 ? betParts[1] : 'unknown';
        this.logger.log(`[GameController] This is a bet game of type: ${betType}`);
      }
      
      return this.buildPlayerResponse(game, id);
    } catch (error) {
      this.logger.error(`Error retrieving game: ${error.message}`);
      throw new NotFoundException(`Game with ID ${id} not found: ${error.message}`);
    }
  }
  
  // Helper to build the player response
  private async buildPlayerResponse(game: Game, requestedId: string) {
    try {
      this.logger.debug(`Building player response for game with ID: ${game.id}, requested with: ${requestedId}`);
      this.logger.debug(`White player ID: ${game.whitePlayerId}, black player ID: ${game.blackPlayerId}`);

      // Always try to get real player data from database
      let whitePlayer, blackPlayer;
      
      try {
        this.logger.log(`Looking up white player with ID: ${game.whitePlayerId}`);
        whitePlayer = await this.usersService.findOne(game.whitePlayerId);
        
        this.logger.log(`Looking up black player with ID: ${game.blackPlayerId}`);
        blackPlayer = await this.usersService.findOne(game.blackPlayerId);

        // If player data couldn't be found in the database, log detailed error
        if (!whitePlayer || !blackPlayer) {
          this.logger.warn(`User data incomplete: whitePlayer=${!!whitePlayer}, blackPlayer=${!!blackPlayer}`);
          
          // For bet games, we want to be more lenient - create placeholder data if needed
          if (requestedId.length >= 32 && requestedId.includes('-')) {
            this.logger.log(`Creating placeholder data for bet game player(s)`);
            
            whitePlayer = whitePlayer || { 
              id: game.whitePlayerId, 
              username: 'White Player',
              displayName: 'White Player',
              rating: game.whitePlayerRating || 1500,
              photoURL: null
            };
            
            blackPlayer = blackPlayer || { 
              id: game.blackPlayerId, 
              username: 'Black Player',
              displayName: 'Black Player',
              rating: game.blackPlayerRating || 1500,
              photoURL: null
            };
          } else {
            throw new NotFoundException('One or both players not found');
          }
        }
      } catch (error) {
        this.logger.error(`Error retrieving player data: ${error.message}`);
        throw new NotFoundException(`Error retrieving player data: ${error.message}`);
      }

      // Get the correct ratings from the game entity
      const whiteRating = game.whitePlayerRating || whitePlayer.rating || 1500;
      const blackRating = game.blackPlayerRating || blackPlayer.rating || 1500;

      // Create effective photo URLs that prioritize custom photos over Firebase photos
      const whitePlayerPhotoURL = whitePlayer.custom_photo_base64 || whitePlayer.photoURL;
      const blackPlayerPhotoURL = blackPlayer.custom_photo_base64 || blackPlayer.photoURL;
      
      // Prioritize custom usernames over displayName
      const whitePlayerUsername = whitePlayer.username || whitePlayer.displayName || 'White Player';
      const blackPlayerUsername = blackPlayer.username || blackPlayer.displayName || 'Black Player';

      const response = {
        whitePlayer: { 
          username: whitePlayerUsername, 
          rating: whiteRating,
          photoURL: whitePlayerPhotoURL,
          userId: whitePlayer.id
        },
        blackPlayer: { 
          username: blackPlayerUsername, 
          rating: blackRating,
          photoURL: blackPlayerPhotoURL,
          userId: blackPlayer.id
        }
      };

      this.logger.log(`Returning player data for game ${game.id}:`, {
        white: `${response.whitePlayer.username} (${response.whitePlayer.rating})`,
        black: `${response.blackPlayer.username} (${response.blackPlayer.rating})`
      });
      
      return response;
    } catch (error) {
      this.logger.error(`Error building player response: ${error.message}`);
      throw error;
    }
  }
  
  @Get(':id/result')
  @UseGuards(FirebaseAuthGuard)
  async getGameResult(@Param('id') id: string) {
    this.logger.log(`Received request for game result with ID: ${id}`);
    
    // Find the game using the repository service
    const game = await this.gameRepositoryService.findOne(id);
    if (!game) {
      this.logger.error(`Game with ID ${id} not found`);
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
    
    this.logger.debug(`Found game with ID: ${game.id}, status: ${game.status}, endReason: ${game.endReason || 'none'}`);

    // Get player data
    let whitePlayer, blackPlayer;
    
    try {
      this.logger.log(`Looking up white player with ID: ${game.whitePlayerId}`);
      whitePlayer = await this.usersService.findOne(game.whitePlayerId);
      
      this.logger.log(`Looking up black player with ID: ${game.blackPlayerId}`);
      blackPlayer = await this.usersService.findOne(game.blackPlayerId);

      // If player data couldn't be found in the database, log detailed error
      if (!whitePlayer || !blackPlayer) {
        this.logger.warn(`User data incomplete: whitePlayer=${!!whitePlayer}, blackPlayer=${!!blackPlayer}`);
        throw new NotFoundException('One or both players not found');
      }
    } catch (error) {
      this.logger.error(`Error retrieving player data: ${error.message}`);
      throw new NotFoundException(`Error retrieving player data: ${error.message}`);
    }

    // Calculate rating changes
    const whiteRatingBefore = game.whitePlayerRating || 1500;
    const blackRatingBefore = game.blackPlayerRating || 1500;
    const whiteRatingAfter = game.whitePlayerRatingAfter || whitePlayer.rating || whiteRatingBefore;
    const blackRatingAfter = game.blackPlayerRatingAfter || blackPlayer.rating || blackRatingBefore;
    
    const whiteRatingChange = whiteRatingAfter - whiteRatingBefore;
    const blackRatingChange = blackRatingAfter - blackRatingBefore;
    
    // Determine winner and loser
    let winner = null;
    let loser = null;
    let resultType = 'ongoing';
    
    if (game.status === 'white_win') {
      winner = whitePlayer;
      loser = blackPlayer;
      resultType = 'white_win';
    } else if (game.status === 'black_win') {
      winner = blackPlayer;
      loser = whitePlayer;
      resultType = 'black_win';
    } else if (game.status === 'draw') {
      resultType = 'draw';
    } else if (game.status === 'aborted') {
      resultType = 'aborted';
    }

    // Construct the response
    const response = {
      gameId: game.id,
      customId: game.customId,
      status: game.status,
      resultType,
      endReason: game.endReason || null,
      whitePlayer: {
        id: game.whitePlayerId,
        username: whitePlayer.displayName,
        rating: whiteRatingAfter,
        ratingBefore: whiteRatingBefore,
        ratingChange: whiteRatingChange,
        photoURL: whitePlayer.photoURL || null
      },
      blackPlayer: {
        id: game.blackPlayerId,
        username: blackPlayer.displayName,
        rating: blackRatingAfter,
        ratingBefore: blackRatingBefore,
        ratingChange: blackRatingChange,
        photoURL: blackPlayer.photoURL || null
      },
      winnerId: game.winnerId || null,
      rated: game.rated,
      timeControl: game.timeControl,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    };

    this.logger.log(`Returning game result data for game ${game.id}`);
    return response;
  }
}
