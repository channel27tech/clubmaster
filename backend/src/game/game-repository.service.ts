import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

@Injectable()
export class GameRepositoryService {
  private readonly logger = new Logger(GameRepositoryService.name);

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

  async findAll(): Promise<Game[]> {
    return this.gamesRepository.find();
  }

  async findRecentGames(limit: number = 10): Promise<Game[]> {
    return this.gamesRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<Game | null> {
    try {
      // Check if we received a full game ID in the format 'game_timestamp_id'
      if (id.includes('game_')) {
        // This is a custom format like 'game_1747841011532_2thg993'
        // Store the full ID as customId for future lookups
        const customId = id;
        this.logger.log(`Received custom format game ID: ${customId}`);
        
        // Try to find the game by customId
        const gameByCustomId = await this.gamesRepository.findOne({
          where: { customId },
          relations: ['whitePlayer', 'blackPlayer'],
        });
        
        if (gameByCustomId) {
          this.logger.log(`Found game with customId '${customId}': ${gameByCustomId.id}`);
          return gameByCustomId;
        }
        
        // If not found by full customId, extract the identifier part
        const parts = id.split('_');
        if (parts.length >= 3) {
          const shortId = parts[parts.length - 1]; // e.g., '2thg993' from 'game_1747841011532_2thg993'
          this.logger.log(`Extracted short ID '${shortId}' from format '${id}'`);
          
          // Try to find by the extracted short ID as customId
          const gameByShortId = await this.gamesRepository.findOne({
            where: { customId: shortId },
            relations: ['whitePlayer', 'blackPlayer'],
          });
          
          if (gameByShortId) {
            this.logger.log(`Found game with short ID '${shortId}': ${gameByShortId.id}`);
            return gameByShortId;
          }
          
          // If still not found, try to find any game where customId contains the short ID
          // This uses a safe approach for PostgreSQL with UUID columns
          const games = await this.gamesRepository.createQueryBuilder('game')
            .where('game.customId LIKE :pattern', { pattern: `%${shortId}%` })
            .leftJoinAndSelect('game.whitePlayer', 'whitePlayer')
            .leftJoinAndSelect('game.blackPlayer', 'blackPlayer')
            .getMany();
          
          if (games.length > 0) {
            if (games.length > 1) {
              this.logger.warn(`Found ${games.length} games matching short ID '${shortId}'. Using the first match: ${games[0].id}`);
            } else {
              this.logger.log(`Found game containing short ID '${shortId}': ${games[0].id}`);
            }
            return games[0];
          }
        }
        
        // If we still haven't found the game, log and return null
        this.logger.warn(`No game found with custom ID '${customId}' or any part of it`);
        return null;
      }
      
      // Check if this is a valid UUID
      if (this.isValidUuid(id)) {
        // This is a standard UUID, do a direct lookup
        this.logger.log(`Looking up game with UUID: ${id}`);
        return this.gamesRepository.findOne({
          where: { id },
          relations: ['whitePlayer', 'blackPlayer'],
        });
      }
      
      // If it's not a UUID or custom format, try to find by customId
      this.logger.log(`Looking up game with customId: ${id}`);
      const game = await this.gamesRepository.findOne({
        where: { customId: id },
        relations: ['whitePlayer', 'blackPlayer'],
      });
      
      if (game) {
        this.logger.log(`Found game with customId '${id}': ${game.id}`);
        return game;
      }
      
      // If we get here, we couldn't find the game
      this.logger.warn(`No game found with ID or customId '${id}'`);
      return null;
    } catch (error) {
      this.logger.error(`Error finding game with ID ${id}: ${error.message}`);
      return null;
    }
  }

  async create(gameData: Partial<Game>): Promise<Game> {
    // --- ADD THIS LOGGING BLOCK ---
    console.log('--- NEW GAME CREATION ATTEMPT ---');
    console.log(`Payload Received: ${JSON.stringify(gameData, null, 2)}`);
    // -----------------------------
    // If no ID provided, generate a new UUID
    if (!gameData.id) {
      gameData.id = uuidv4();
    } else if (!this.isValidUuid(gameData.id)) {
      // If ID provided but it's not a valid UUID, generate a new one and log warning
      this.logger.warn(`Invalid UUID format provided: ${gameData.id} - generating new UUID`);
      gameData.id = uuidv4();
    }
    
    // If a custom ID format is provided (e.g., 'game_timestamp_id'), store it in customId
    if (gameData.customId) {
      this.logger.log(`Using provided customId: ${gameData.customId}`);
    } else if (typeof gameData.id === 'string' && gameData.id.includes('game_')) {
      // If the ID is in the format 'game_timestamp_id', store it as customId
      gameData.customId = gameData.id;
      this.logger.log(`Stored game ID as customId: ${gameData.customId}`);
    } else {
      // Generate a custom ID in the format 'game_timestamp_shortId'
      const timestamp = Date.now();
      const shortId = Math.random().toString(36).substring(2, 9); // 7 character alphanumeric ID
      gameData.customId = `game_${timestamp}_${shortId}`;
      this.logger.log(`Generated customId: ${gameData.customId}`);
    }
    this.logger.log(`[GameRepositoryService] Attempting to save game record to DB with customId: ${gameData.customId} and dbId: ${gameData.id}`);
    try {
    const game = this.gamesRepository.create(gameData);
      const savedGame = await this.gamesRepository.save(game);
      if (!savedGame) {
        this.logger.error(`[GameRepositoryService] ERROR saving game record to DB: save returned null/undefined`);
        throw new Error('Failed to save game record to database');
      }
      this.logger.log(`[GameRepositoryService] Game record successfully saved to DB.`);
      return savedGame;
    } catch (error) {
      this.logger.error(`[GameRepositoryService] ERROR saving game record to DB: ${error.message}`);
      throw new Error(`Failed to save game record to database: ${error.message}`);
    }
  }

  async update(id: string, gameData: Partial<Game>): Promise<Game | null> {
    // Validate UUID format
    if (!this.isValidUuid(id)) {
      this.logger.warn(`Invalid UUID format for update: ${id}`);
      return null;
    }
    
    this.logger.log(`Updating game ${id} with data: ${JSON.stringify(gameData)}`);
    
    try {
      // Find the game first to make sure it exists and to log before/after values
      const beforeGame = await this.findOne(id);
      if (!beforeGame) {
        this.logger.warn(`Game not found for update: ${id}`);
        return null;
      }
      
      // Log important changes for debugging
      if (gameData.whitePlayerRatingAfter !== undefined || gameData.blackPlayerRatingAfter !== undefined) {
        this.logger.log(`Rating update for game ${id}:`);
        this.logger.log(`Before - White: ${beforeGame.whitePlayerRating}, Black: ${beforeGame.blackPlayerRating}`);
        this.logger.log(`After  - White: ${gameData.whitePlayerRatingAfter || beforeGame.whitePlayerRatingAfter || beforeGame.whitePlayerRating}, Black: ${gameData.blackPlayerRatingAfter || beforeGame.blackPlayerRatingAfter || beforeGame.blackPlayerRating}`);
      }
      
      // Perform the update
      const result = await this.gamesRepository.update(id, gameData);
      this.logger.log(`Update result for game ${id}: ${result.affected} row(s) affected`);
      
      if (result.affected === 0) {
        this.logger.error(`Game update failed: No rows affected for game ID ${id}`);
        
        // Try direct update as a fallback
        this.logger.log(`Attempting direct update via query builder as fallback`);
        const directResult = await this.gamesRepository.createQueryBuilder()
          .update(Game)
          .set(gameData)
          .where("id = :id", { id })
          .execute();
          
        this.logger.log(`Direct update result: ${directResult.affected} row(s) affected`);
        
        if (directResult.affected === 0) {
          this.logger.error(`Direct update also failed for game ${id}`);
          return null;
        }
      }
      
      // Get the updated game
      const afterGame = await this.findOne(id);
      if (!afterGame) {
        this.logger.warn(`Game not found after update: ${id}`);
        return null;
      }
      
      // Verify rating updates if applicable
      if (gameData.whitePlayerRatingAfter !== undefined || gameData.blackPlayerRatingAfter !== undefined) {
        this.logger.log(`Verified rating update for game ${id}:`);
        this.logger.log(`White: ${beforeGame.whitePlayerRating} → ${afterGame.whitePlayerRatingAfter}`);
        this.logger.log(`Black: ${beforeGame.blackPlayerRating} → ${afterGame.blackPlayerRatingAfter}`);
        
        // Check if ratings were actually updated
        if (gameData.whitePlayerRatingAfter !== undefined && 
            afterGame.whitePlayerRatingAfter !== gameData.whitePlayerRatingAfter) {
          this.logger.error(`White player rating not updated correctly. Expected: ${gameData.whitePlayerRatingAfter}, Actual: ${afterGame.whitePlayerRatingAfter}`);
        }
        
        if (gameData.blackPlayerRatingAfter !== undefined && 
            afterGame.blackPlayerRatingAfter !== gameData.blackPlayerRatingAfter) {
          this.logger.error(`Black player rating not updated correctly. Expected: ${gameData.blackPlayerRatingAfter}, Actual: ${afterGame.blackPlayerRatingAfter}`);
        }
      }
      
      return afterGame;
    } catch (error) {
      this.logger.error(`Error updating game ${id}: ${error.message}`, error.stack);
      return null;
    }
  }

  async endGame(
    id: string,
    status: 'white_win' | 'black_win' | 'draw' | 'aborted',
    endReason: string,
    pgn?: string,
    moves?: any[],
    totalMoves?: number,
  ): Promise<Game | null> {
    // Validate UUID format
    if (!this.isValidUuid(id)) {
      this.logger.warn(`Invalid UUID format for endGame: ${id}`);
      return null;
    }
    
    const updateData: Partial<Game> = {
      status,
      endReason,
    };

    if (pgn) {
      updateData.pgn = pgn;
    }
    
    // Add moves and totalMoves if provided
    if (moves) {
      updateData.moves = moves;
    }
    
    if (totalMoves !== undefined) {
      updateData.totalMoves = totalMoves;
    }

    // Find the game first to make sure it exists
    const game = await this.findOne(id);
    if (!game) {
      this.logger.warn(`Game not found for endGame: ${id}`);
      return null;
    }

    if (status === 'white_win') {
      updateData.winnerId = game.whitePlayerId;
    } else if (status === 'black_win') {
      updateData.winnerId = game.blackPlayerId;
    }

    await this.gamesRepository.update(id, updateData);
    return this.findOne(id);
  }

  async addMove(id: string, move: any): Promise<Game | null> {
    // Validate UUID format
    if (!this.isValidUuid(id)) {
      this.logger.warn(`Invalid UUID format for addMove: ${id}`);
      return null;
    }
    
    const game = await this.findOne(id);
    if (!game) {
      return null;
    }

    if (!game.moves) {
      game.moves = [];
    }

    game.moves.push(move);
    game.totalMoves = game.moves.length;

    return this.gamesRepository.save(game);
  }

  async findPlayerGames(playerId: string, limit: number = 10): Promise<Game[]> {
    // Validate UUID format
    if (!this.isValidUuid(playerId)) {
      this.logger.warn(`Invalid UUID format for findPlayerGames: ${playerId}`);
      return [];
    }
    
    return this.gamesRepository.find({
      where: [
        { whitePlayerId: playerId },
        { blackPlayerId: playerId },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  async getGameStats(playerId: string): Promise<{
    total: number;
    wins: number;
    losses: number;
    draws: number;
  }> {
    // Validate UUID format
    if (!this.isValidUuid(playerId)) {
      this.logger.warn(`Invalid UUID format for getGameStats: ${playerId}`);
      return { total: 0, wins: 0, losses: 0, draws: 0 };
    }
    
    // Get all games where the player was white
    const whiteGames = await this.gamesRepository.find({
      where: { whitePlayerId: playerId },
    });

    // Get all games where the player was black
    const blackGames = await this.gamesRepository.find({
      where: { blackPlayerId: playerId },
    });

    const games = [...whiteGames, ...blackGames];

    const stats = {
      total: games.length,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    for (const game of games) {
      if (game.status === 'draw') {
        stats.draws++;
      } else if (
        (game.status === 'white_win' && game.whitePlayerId === playerId) ||
        (game.status === 'black_win' && game.blackPlayerId === playerId)
      ) {
        stats.wins++;
      } else if (
        (game.status === 'white_win' && game.blackPlayerId === playerId) ||
        (game.status === 'black_win' && game.whitePlayerId === playerId)
      ) {
        stats.losses++;
      }
    }

    return stats;
  }
  
  // Helper method to validate UUID format
  private isValidUuid(id: string): boolean {
    return uuidValidate(id);
  }

  // Find a game by customId (used for client-facing gameId)
  async findOneByCustomId(customId: string): Promise<Game | null> {
    try {
      this.logger.log(`[findOneByCustomId] Looking up game with customId: ${customId}`);
      
      // First try direct match
      let game = await this.gamesRepository.findOne({
        where: { customId },
        relations: ['whitePlayer', 'blackPlayer'],
      });
      
      if (game) {
        this.logger.log(`[findOneByCustomId] Found game with exact customId match: ${game.id}`);
        return game;
      }
      
      // If direct match failed, try by UUID (some bet games might have UUID as customId)
      if (this.isValidUuid(customId)) {
        this.logger.log(`[findOneByCustomId] customId is a valid UUID, trying direct ID lookup`);
        game = await this.gamesRepository.findOne({
          where: { id: customId },
          relations: ['whitePlayer', 'blackPlayer'],
        });
        
        if (game) {
          this.logger.log(`[findOneByCustomId] Found game by UUID: ${game.id}`);
          return game;
        }
      }
      
      // If UUID lookup failed, try partial match (especially for bet games)
      this.logger.log(`[findOneByCustomId] No exact match, trying partial match with pattern: %${customId}%`);
      
      // Try to find any game where customId contains the given ID
      const gamesWithPartialMatch = await this.gamesRepository.createQueryBuilder('game')
        .where('game.customId LIKE :pattern', { pattern: `%${customId}%` })
        .leftJoinAndSelect('game.whitePlayer', 'whitePlayer')
        .leftJoinAndSelect('game.blackPlayer', 'blackPlayer')
        .getMany();
      
      if (gamesWithPartialMatch.length > 0) {
        if (gamesWithPartialMatch.length > 1) {
          this.logger.warn(`[findOneByCustomId] Found ${gamesWithPartialMatch.length} games with partial match for '${customId}'. Using the first one: ${gamesWithPartialMatch[0].id}`);
        } else {
          this.logger.log(`[findOneByCustomId] Found game with partial customId match: ${gamesWithPartialMatch[0].id}`);
        }
        return gamesWithPartialMatch[0];
      }
      
      // If nothing found even with partial match
      this.logger.warn(`[findOneByCustomId] No game found with customId ${customId} (exact or partial match)`);
      return null;
    } catch (error) {
      this.logger.error(`[findOneByCustomId] Error finding game with customId ${customId}: ${error.message}`);
      return null;
    }
  }
} 