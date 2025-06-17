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
   
    // Use the customId-aware lookup
    const game = await this.gameRepositoryService.findOneByCustomId(id);
    if (!game) {
      this.logger.error(`Game with ID ${id} not found`);
      throw new NotFoundException(`Game with ID ${id} not found`);
    }
    this.logger.log(`[GameController] Found game for customId ${id}: ${game.id}`);
    
    this.logger.debug(`Found game with ID: ${game.id}, white player ID: ${game.whitePlayerId}, black player ID: ${game.blackPlayerId}`);

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
        throw new NotFoundException('One or both players not found');
      }
    } catch (error) {
      this.logger.error(`Error retrieving player data: ${error.message}`);
      throw new NotFoundException(`Error retrieving player data: ${error.message}`);
    }

    // Get the correct ratings from the game entity
    const whiteRating = game.whitePlayerRating || whitePlayer.rating || 1500;
    const blackRating = game.blackPlayerRating || blackPlayer.rating || 1500;

    const response = {
      whitePlayer: { 
        username: whitePlayer.displayName, 
        rating: whiteRating,
        photoURL: whitePlayer.photoURL || null,
        userId: whitePlayer.id
      },
      blackPlayer: { 
        username: blackPlayer.displayName, 
        rating: blackRating,
        photoURL: blackPlayer.photoURL || null,
        userId: blackPlayer.id
      }
    };

    this.logger.log(`Returning player data for game ${game.id}:`, {
      white: `${response.whitePlayer.username} (${response.whitePlayer.rating})`,
      black: `${response.blackPlayer.username} (${response.blackPlayer.rating})`
    });
    
    return response;
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
