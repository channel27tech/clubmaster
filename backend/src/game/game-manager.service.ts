import { Injectable, Logger } from '@nestjs/common';
import { Chess, Move } from 'chess.js';
import { Server } from 'socket.io';
import { 
  GameEndService, 
  GameEndDetails,
  GameEndReason,
  GameResult
} from './game-end/game-end.service';
import { RatingService, RatingChange, RatingResult as RatingServiceResult } from './rating/rating.service';
import { GameRepositoryService } from './game-repository.service';
import { UsersService } from '../users/users.service';

// Player type for active games
export interface GamePlayer {
  socketId: string;
  userId?: string; // Will be undefined for guests
  rating?: number; // Will be undefined for guests
  username: string;
  isGuest: boolean;
  gamesPlayed?: number;
  connected: boolean; // Track connection status
  connectionLostTime?: Date; // When the player disconnected
  photoURL?: string; // Player's profile photo URL
}

// Game state for active games
export interface GameState {
  gameId: string;
  dbGameId?: string; // Database UUID for persistence
  whitePlayer: GamePlayer;
  blackPlayer: GamePlayer;
  chessInstance: Chess;
  pgn: string; // Current game PGN
  gameMode: string;
  timeControl: string;
  rated: boolean;
  started: boolean;
  ended: boolean;
  startTime: Date;
  endTime?: Date;
  lastMoveTime?: Date;
  result?: GameResult;
  endReason?: GameEndReason;
  whiteTimeRemaining: number; // In milliseconds
  blackTimeRemaining: number; // In milliseconds
  whiteTurn: boolean; // Is it white's turn?
  isFirstMove: boolean; // Is this the first move of the game?
}

// Game result data used for return values
export interface GameResultData {
  gameId: string;
  result: GameResult;
  reason: GameEndReason;
  winnerUserId?: string;
  loserUserId?: string;
  whiteRatingChange?: RatingChange;
  blackRatingChange?: RatingChange;
  pgn: string;
  gameMode: string;
  timeControl: string;
  rated: boolean;
  startTime: Date;
  endTime: Date;
  whitePlayer: {
    userId?: string;
    username: string;
    isGuest: boolean;
    rating?: number;
  };
  blackPlayer: {
    userId?: string;
    username: string;
    isGuest: boolean;
    rating?: number;
  };
}

@Injectable()
export class GameManagerService {
  private readonly logger = new Logger(GameManagerService.name);
  
  // Map of active games by gameId
  private activeGames: Map<string, GameState> = new Map();
  
  // Map of players to their active games
  private playerGameMap: Map<string, string> = new Map();
  
  // Grace period for reconnections: 2 minutes
  private readonly RECONNECTION_GRACE_PERIOD = 2 * 60 * 1000;

  constructor(
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Create a new game and add it to active games
   */
  createGame(
    gameId: string,
    whitePlayer: GamePlayer,
    blackPlayer: GamePlayer,
    gameMode: string,
    timeControl: string,
    rated: boolean,
  ): GameState {
    // Parse time control string (e.g., '5+0' for 5 minutes with 0 increment)
    const [baseMinutes] = timeControl.split('+').map(Number);
    const baseTimeMs = baseMinutes * 60 * 1000;
    
    // Create a new chess instance
    const chessInstance = new Chess();
    
    // Create game state
    const gameState: GameState = {
      gameId,
      whitePlayer,
      blackPlayer,
      chessInstance,
      pgn: '',
      gameMode,
      timeControl,
      rated,
      started: false,
      ended: false,
      startTime: new Date(),
      whiteTimeRemaining: baseTimeMs,
      blackTimeRemaining: baseTimeMs,
      whiteTurn: true, // White always starts
      isFirstMove: true,
    };
    
    // Add game to active games
    this.activeGames.set(gameId, gameState);
    
    // Map players to game
    this.playerGameMap.set(whitePlayer.socketId, gameId);
    this.playerGameMap.set(blackPlayer.socketId, gameId);
    
    this.logger.log(`Game created: ${gameId}`);
    
    return gameState;
  }

  /**
   * Get a game by ID
   */
  getGame(gameId: string): GameState | undefined {
    return this.activeGames.get(gameId);
  }

  /**
   * Get a game by player socket ID
   */
  getGameByPlayerId(socketId: string): GameState | undefined {
    const gameId = this.playerGameMap.get(socketId);
    if (!gameId) return undefined;
    return this.activeGames.get(gameId);
  }

  /**
   * Start a game
   */
  startGame(gameId: string): boolean {
    const game = this.activeGames.get(gameId);
    if (!game) return false;
    
    game.started = true;
    game.startTime = new Date();
    game.lastMoveTime = new Date();
    
    return true;
  }

  /**
   * Make a move in a game
   */
  makeMove(gameId: string, move: string, socketId: string): boolean {
    const game = this.activeGames.get(gameId);
    if (!game) return false;
    
    // Validate that it's the player's turn
    if (
      (game.whiteTurn && game.whitePlayer.socketId !== socketId) ||
      (!game.whiteTurn && game.blackPlayer.socketId !== socketId)
    ) {
      return false;
    }
    
    try {
      // Make the move
      const result = game.chessInstance.move(move) as Move | null;
      if (!result) {
        return false;
      }
      
      // Update game state
      game.pgn = game.chessInstance.pgn();
      game.lastMoveTime = new Date();
      game.whiteTurn = !game.whiteTurn;
      
      // If this was the first move of the game, mark it
      if (game.isFirstMove) {
        game.isFirstMove = false;
        
        // If this is a registered game with a database record, update the database
        if (game.dbGameId) {
          // Attempt to update move in database asynchronously - no need to await
          this.updateMoveInDatabase(game).catch(error => {
            this.logger.error(`Error updating move in database: ${error.message}`, error.stack);
          });
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Invalid move in game ${gameId}: ${move}`, error);
      return false;
    }
  }

  /**
   * Update move history in database
   */
  private async updateMoveInDatabase(game: GameState): Promise<void> {
    if (!game.dbGameId) return;
    
    try {
      // Get move history
      const moveHistory = game.chessInstance.history({ verbose: true });
      
      // Format moves for JSONB storage
      const formattedMoves = moveHistory.map(move => ({
        from: move.from,
        to: move.to,
        piece: move.piece,
        san: move.san,
        color: move.color,
        flags: move.flags,
        ...(move.promotion && { promotion: move.promotion })
      }));
      
      // Update the game record with the latest moves
      await this.gameRepositoryService.update(game.dbGameId, {
        pgn: game.pgn,
        moves: formattedMoves,
        totalMoves: moveHistory.length
      });
      
      this.logger.log(`Updated move history in database for game ${game.dbGameId}`);
    } catch (error) {
      this.logger.error(`Error updating move history in database: ${error.message}`, error.stack);
    }
  }

  /**
   * Check if a game has ended due to chess rules
   */
  checkGameEnd(gameId: string, server: Server): Promise<GameResultData> | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
    // Check game end conditions
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chessInstance,
      game.whitePlayer.socketId,
      game.blackPlayer.socketId,
      undefined, // No timeout yet
      undefined, // No resignation yet
      false, // No draw agreement yet
      undefined, // No disconnection yet
      game.isFirstMove,
    );
    
    if (gameEndDetails) {
      return this.handleGameEnd(gameId, gameEndDetails, server);
    }
    
    return null;
  }

  /**
   * Register a timeout in a game
   */
  registerTimeout(
    gameId: string,
    color: 'w' | 'b',
    server: Server,
  ): Promise<GameResultData> | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
    // Log timeout detection at entry point
    this.logger.log(`[TIMEOUT] Processing timeout for ${color === 'w' ? 'white' : 'black'} player in game ${gameId}`);
    
    // Check game end based on timeout
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chessInstance,
      game.whitePlayer.socketId,
      game.blackPlayer.socketId,
      color, // Player who timed out
      undefined, // No resignation
      false, // No draw agreement
      undefined, // No disconnection
      game.isFirstMove,
    );
    
    if (gameEndDetails) {
      // Log timeout detection with detailed info
      this.logger.log(`[TIMEOUT] Timeout confirmed for ${color === 'w' ? 'white' : 'black'} player in game ${gameId}`);
      this.logger.log(`[TIMEOUT] Game end details: result=${gameEndDetails.result}, reason=${gameEndDetails.reason}`);
      this.logger.log(`[TIMEOUT] Database ID: ${game.dbGameId || 'not available'}`);
      
      return this.handleGameEnd(gameId, gameEndDetails, server);
    }
    
    return null;
  }

  /**
   * Register a resignation in a game
   */
  registerResignation(
    gameId: string,
    socketId: string,
    server: Server,
  ): Promise<GameResultData> | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
    // Determine which player resigned
    const isWhiteResigning = game.whitePlayer.socketId === socketId;
    const resigningColor = isWhiteResigning ? 'w' : 'b';
    
    // Explicitly identify winner and loser by socketId
    const winnerSocketId = isWhiteResigning ? game.blackPlayer.socketId : game.whitePlayer.socketId;
    const loserSocketId = socketId; // the resigning player is always the loser
    
    this.logger.log(`Resignation details - Winner: ${winnerSocketId}, Loser: ${loserSocketId}, isWhiteResigning: ${isWhiteResigning}`);
    
    // Check game end based on resignation
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chessInstance,
      game.whitePlayer.socketId,
      game.blackPlayer.socketId,
      undefined, // No timeout
      resigningColor, // Player who resigned
      false, // No draw agreement
      undefined, // No disconnection
      game.isFirstMove,
    );
    
    if (gameEndDetails) {
      // Override the game end details to ensure socket IDs are always set correctly
      // This ensures frontend always receives valid IDs for winner/loser display
      gameEndDetails.winnerSocketId = winnerSocketId;
      gameEndDetails.loserSocketId = loserSocketId;
      
      return this.handleGameEnd(gameId, gameEndDetails, server);
    }
    
    return null;
  }

  /**
   * Register a player disconnection
   */
  registerDisconnection(socketId: string, server: Server): void {
    const gameId = this.playerGameMap.get(socketId);
    if (!gameId) return;
    
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return;
    
    // Mark player as disconnected and record the time
    if (game.whitePlayer.socketId === socketId) {
      game.whitePlayer.connected = false;
      game.whitePlayer.connectionLostTime = new Date();
    } else if (game.blackPlayer.socketId === socketId) {
      game.blackPlayer.connected = false;
      game.blackPlayer.connectionLostTime = new Date();
    }
    
    this.logger.log(`Player ${socketId} disconnected from game ${gameId}`);
    
    // Schedule a check for game abandonment
    setTimeout(() => {
      this.checkForAbandonment(gameId, socketId, server);
    }, this.RECONNECTION_GRACE_PERIOD);
  }

  /**
   * Register a player reconnection
   */
  registerReconnection(socketId: string, newSocketId: string): boolean {
    const gameId = this.playerGameMap.get(socketId);
    if (!gameId) return false;
    
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return false;
    
    // Update player socket ID and connection status
    if (game.whitePlayer.socketId === socketId) {
      game.whitePlayer.socketId = newSocketId;
      game.whitePlayer.connected = true;
      game.whitePlayer.connectionLostTime = undefined;
      
      // Update player game map
      this.playerGameMap.delete(socketId);
      this.playerGameMap.set(newSocketId, gameId);
      
      this.logger.log(`White player reconnected to game ${gameId}`);
      return true;
    } else if (game.blackPlayer.socketId === socketId) {
      game.blackPlayer.socketId = newSocketId;
      game.blackPlayer.connected = true;
      game.blackPlayer.connectionLostTime = undefined;
      
      // Update player game map
      this.playerGameMap.delete(socketId);
      this.playerGameMap.set(newSocketId, gameId);
      
      this.logger.log(`Black player reconnected to game ${gameId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Check for game abandonment (player disconnect beyond grace period)
   */
  private checkForAbandonment(
    gameId: string,
    socketId: string,
    server: Server,
  ): void {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return;
    
    let disconnectedPlayer: GamePlayer | null = null;
    let disconnectedColor: 'w' | 'b' | null = null;
    
    // Find the disconnected player
    if (game.whitePlayer.socketId === socketId && !game.whitePlayer.connected) {
      disconnectedPlayer = game.whitePlayer;
      disconnectedColor = 'w';
    } else if (
      game.blackPlayer.socketId === socketId &&
      !game.blackPlayer.connected
    ) {
      disconnectedPlayer = game.blackPlayer;
      disconnectedColor = 'b';
    }
    
    // If player is still disconnected, check if grace period has expired
    if (
      disconnectedPlayer &&
      disconnectedColor &&
      disconnectedPlayer.connectionLostTime
    ) {
      const now = new Date();
      const disconnectDuration = now.getTime() - disconnectedPlayer.connectionLostTime.getTime();
      
      // For games with clocks, the grace period is the minimum of the standard grace period
      // and the player's remaining time
      const effectiveGracePeriod = disconnectedColor === 'w'
        ? Math.min(this.RECONNECTION_GRACE_PERIOD, game.whiteTimeRemaining)
        : Math.min(this.RECONNECTION_GRACE_PERIOD, game.blackTimeRemaining);
      
      // Get the remaining time for the disconnected player
      const remainingTime = disconnectedColor === 'w' ? game.whiteTimeRemaining : game.blackTimeRemaining;
      
      if (disconnectDuration >= effectiveGracePeriod) {
        // Check if this was a timeout (remaining time reached zero) or just a disconnection
        const isTimeout = remainingTime <= 0;
        
        // Log the detection for debugging
        this.logger.log(`[TIMEOUT CHECK] Player ${disconnectedColor} disconnect grace period expired. isTimeout: ${isTimeout}, remainingTime: ${remainingTime}ms`);
        
        // Grace period expired, determine if this is a timeout or abandonment
        const gameEndDetails = this.gameEndService.checkGameEnd(
          game.chessInstance,
          game.whitePlayer.socketId,
          game.blackPlayer.socketId,
          isTimeout ? disconnectedColor : undefined, // Pass color as timeout if time is zero
          undefined, // No resignation
          false, // No draw agreement
          isTimeout ? undefined : disconnectedColor, // Only pass as disconnection if not a timeout
          game.isFirstMove,
        );
        
        if (gameEndDetails) {
          // Log the reason for clarity
          this.logger.log(`[TIMEOUT CHECK] Game end reason determined: ${gameEndDetails.reason}`);
          this.handleGameEnd(gameId, gameEndDetails, server);
        }
      }
    }
  }

  /**
   * Handle game end logic
   */
  private async handleGameEnd(
    gameId: string,
    gameEndDetails: GameEndDetails,
    server: Server,
  ): Promise<GameResultData> {
    const game = this.activeGames.get(gameId);
    if (!game) {
      this.logger.error(`Game not found in handleGameEnd: ${gameId}`);
      throw new Error(`Game ${gameId} not found during handleGameEnd.`);
    }

    if (game.ended) {
      this.logger.warn(`Game ${gameId} already ended. Ignoring duplicate handleGameEnd call.`);
      return {
        gameId: game.gameId,
        result: game.result || gameEndDetails.result,
        reason: game.endReason || gameEndDetails.reason,
        winnerUserId: gameEndDetails.winnerSocketId === game.whitePlayer.socketId ? game.whitePlayer.userId : (gameEndDetails.winnerSocketId === game.blackPlayer.socketId ? game.blackPlayer.userId : undefined),
        loserUserId: gameEndDetails.loserSocketId === game.whitePlayer.socketId ? game.whitePlayer.userId : (gameEndDetails.loserSocketId === game.blackPlayer.socketId ? game.blackPlayer.userId : undefined),
        pgn: game.pgn,
        gameMode: game.gameMode,
        timeControl: game.timeControl,
        rated: game.rated,
        startTime: game.startTime,
        endTime: game.endTime || new Date(),
        whitePlayer: {
          userId: game.whitePlayer.userId,
          username: game.whitePlayer.username,
          isGuest: game.whitePlayer.isGuest,
          rating: game.whitePlayer.rating,
        },
        blackPlayer: {
          userId: game.blackPlayer.userId,
          username: game.blackPlayer.username,
          isGuest: game.blackPlayer.isGuest,
          rating: game.blackPlayer.rating,
        },
      };
    }

    this.logger.log(
      `Handling game end for ${gameId}. Reason: ${gameEndDetails.reason}, Result: ${gameEndDetails.result}`,
    );

    game.ended = true;
    game.endTime = new Date();
    game.result = gameEndDetails.result;
    game.endReason = gameEndDetails.reason;

    let whiteRatingChange: RatingChange | undefined;
    let blackRatingChange: RatingChange | undefined;

    // Only calculate rating changes if:
    // 1. Game is rated
    // 2. Game is not aborted
    // 3. Both players are registered (not guests)
    if (game.rated && gameEndDetails.reason !== GameEndReason.ABORT) {
      if (!game.whitePlayer.isGuest && !game.blackPlayer.isGuest) {
        this.logger.log(`Processing rating changes for rated game ${gameId}`);
        
        // Map game result to rating result
        let whiteResultForRating: RatingServiceResult;

        if (gameEndDetails.result === GameResult.WHITE_WINS) {
          whiteResultForRating = RatingServiceResult.WIN;
        } else if (gameEndDetails.result === GameResult.BLACK_WINS) {
          whiteResultForRating = RatingServiceResult.LOSS;
        } else if (gameEndDetails.result === GameResult.DRAW) {
          whiteResultForRating = RatingServiceResult.DRAW;
        } else {
          this.logger.warn(`Unexpected game result type for rating calculation: ${gameEndDetails.result}. Treating as DRAW for safety.`);
          whiteResultForRating = RatingServiceResult.DRAW;
        }
        
        if (whiteResultForRating !== undefined) { 
            // Get current ratings
            const whiteRating = game.whitePlayer.rating || this.ratingService.DEFAULT_RATING;
            const blackRating = game.blackPlayer.rating || this.ratingService.DEFAULT_RATING;
            
            // Calculate rating changes using the ELO formula
            const ratingChanges = this.ratingService.calculateGameRatingChanges(
                whiteRating, 
                blackRating,
                whiteResultForRating
            );
            
            if (ratingChanges) {
                whiteRatingChange = ratingChanges.white;
                blackRatingChange = ratingChanges.black;
                
                this.logger.log(`Ratings calculated for game ${gameId}:`);
                this.logger.log(`White: ${whiteRating} → ${whiteRatingChange.newRating} (${whiteRatingChange.ratingChange > 0 ? '+' : ''}${whiteRatingChange.ratingChange})`);
                this.logger.log(`Black: ${blackRating} → ${blackRatingChange.newRating} (${blackRatingChange.ratingChange > 0 ? '+' : ''}${blackRatingChange.ratingChange})`);
                
                // Update player ratings in the database if they have user IDs
                if (game.whitePlayer.userId && game.blackPlayer.userId) {
                    try {
                        // Update white player's rating
                        await this.usersService.updateRating(game.whitePlayer.userId, whiteRatingChange.newRating);
                        
                        // Update black player's rating
                        await this.usersService.updateRating(game.blackPlayer.userId, blackRatingChange.newRating);
                        
                        // Update game statistics based on result
                        if (gameEndDetails.result === GameResult.WHITE_WINS) {
                            await this.usersService.incrementGameStats(game.whitePlayer.userId, 'win');
                            await this.usersService.incrementGameStats(game.blackPlayer.userId, 'loss');
                        } else if (gameEndDetails.result === GameResult.BLACK_WINS) {
                            await this.usersService.incrementGameStats(game.whitePlayer.userId, 'loss');
                            await this.usersService.incrementGameStats(game.blackPlayer.userId, 'win');
                        } else if (gameEndDetails.result === GameResult.DRAW) {
                            await this.usersService.incrementGameStats(game.whitePlayer.userId, 'draw');
                            await this.usersService.incrementGameStats(game.blackPlayer.userId, 'draw');
                        }
                        
                        // Store ratings in the game record
                        const dbGame = await this.gameRepositoryService.findOne(gameId);
                        if (dbGame) {
                            // Update game with both before and after ratings
                            await this.gameRepositoryService.update(gameId, {
                                whitePlayerRating: whiteRating,
                                blackPlayerRating: blackRating,
                                whitePlayerRatingAfter: whiteRatingChange.newRating,
                                blackPlayerRatingAfter: blackRatingChange.newRating
                            });
                            this.logger.log(`Game ${gameId} updated with rating information in database`);
                        }
                    } catch (error) {
                        this.logger.error(`Error updating ratings in database: ${error.message}`, error.stack);
                    }
                }
            }
        } else {
             this.logger.log(`Game ${gameId} result (${gameEndDetails.result}) not suitable for standard win/loss/draw rating. Skipping.`);
        }
      } else {
        this.logger.log(
          `Game ${gameId} is rated, but one or both players are guests. Skipping rating changes.`,
        );
      }
    } else {
      if (gameEndDetails.reason === GameEndReason.ABORT) {
        this.logger.log(`Game ${gameId} was aborted. Skipping rating changes.`);
      } else if (!game.rated) {
        this.logger.log(`Game ${gameId} is not rated. Skipping rating changes.`);
      }
    }

    const finalResultData: GameResultData = {
      gameId: game.gameId,
      result: game.result!,
      reason: game.endReason!,
      winnerUserId: gameEndDetails.winnerSocketId === game.whitePlayer.socketId ? game.whitePlayer.userId : (gameEndDetails.winnerSocketId === game.blackPlayer.socketId ? game.blackPlayer.userId : undefined),
      loserUserId: gameEndDetails.loserSocketId === game.whitePlayer.socketId ? game.whitePlayer.userId : (gameEndDetails.loserSocketId === game.blackPlayer.socketId ? game.blackPlayer.userId : undefined),
      whiteRatingChange,
      blackRatingChange,
      pgn: game.pgn,
      gameMode: game.gameMode,
      timeControl: game.timeControl,
      rated: game.rated,
      startTime: game.startTime,
      endTime: game.endTime!,
      whitePlayer: {
        userId: game.whitePlayer.userId,
        username: game.whitePlayer.username,
        isGuest: game.whitePlayer.isGuest,
        rating: game.whitePlayer.rating,
      },
      blackPlayer: {
        userId: game.blackPlayer.userId,
        username: game.blackPlayer.username,
        isGuest: game.blackPlayer.isGuest,
        rating: game.blackPlayer.rating,
      },
    };

    this.logger.log(`Emitting 'game_ended' for ${gameId} with data:`, JSON.stringify(finalResultData, null, 2));
    server.to(gameId).emit('game_ended', finalResultData);

    // Persist final game state to database
    try {
      const status = game.result === GameResult.WHITE_WINS ? 'white_win' : 
                     game.result === GameResult.BLACK_WINS ? 'black_win' : 
                     game.result === GameResult.DRAW ? 'draw' : 'aborted';
                     
      // Extract verbose move history for saving to database
      const moveHistory = game.chessInstance.history({ verbose: true });
      
      // Format moves for JSONB storage
      const formattedMoves = moveHistory.map(move => ({
        from: move.from,
        to: move.to,
        piece: move.piece,
        san: move.san,
        color: move.color,
        flags: move.flags,
        ...(move.promotion && { promotion: move.promotion })
      }));
      
      // Get total number of moves
      const totalMoves = moveHistory.length;
                     
      // Map the GameEndReason enum to database-friendly string values
      // This ensures reasons like 'timeout' are properly stored in the database
      // CRITICAL FIX for timeouts being recorded as "abandon"
      let dbEndReason: string = game.endReason as string;
      if (game.endReason === GameEndReason.TIMEOUT) {
        dbEndReason = 'timeout';
        this.logger.log(`Explicitly mapping timeout game end reason for game ${gameId}`);
      } else if (game.endReason === GameEndReason.ABANDON) {
        dbEndReason = 'abandon';
      } else if (game.endReason === GameEndReason.RESIGNATION) {
        dbEndReason = 'resignation';
      } else if (game.endReason === GameEndReason.CHECKMATE) {
        dbEndReason = 'checkmate';
      } else if (game.endReason === GameEndReason.DRAW_AGREEMENT) {
        dbEndReason = 'draw_agreement';
      } else if (game.endReason === GameEndReason.THREEFOLD_REPETITION) {
        dbEndReason = 'threefold_repetition';
      } else if (game.endReason === GameEndReason.STALEMATE) {
        dbEndReason = 'stalemate';
      } else if (game.endReason === GameEndReason.INSUFFICIENT_MATERIAL) {
        dbEndReason = 'insufficient_material';
      } else if (game.endReason === GameEndReason.FIFTY_MOVE_RULE) {
        dbEndReason = 'fifty_move_rule';
      } else if (game.endReason === GameEndReason.ABORT) {
        dbEndReason = 'abort';
      }

      this.logger.log(`Saving game end to database with reason: ${dbEndReason} (from enum: ${game.endReason})`);
                     
      // Use the database UUID if available, otherwise try the in-memory ID
      const dbId = game.dbGameId || gameId;
      
      // Try to update the existing game record
      const updatedGame = await this.gameRepositoryService.endGame(
        dbId, 
        status, 
        dbEndReason, 
        game.pgn,
        formattedMoves,
        totalMoves
      );
      
      if (updatedGame) {
        this.logger.log(`Game ${dbId} result persisted to database`);
      } else {
        this.logger.warn(`Game ${dbId} not found in database during endGame - may need to be created first`);
        
        // Attempt to create a record if it doesn't exist and both players are registered
        if (game.whitePlayer.userId && game.blackPlayer.userId && !game.whitePlayer.isGuest && !game.blackPlayer.isGuest) {
          // Get ratings information based on game result
          const whiteInitialRating = game.whitePlayer.rating || 1500;
          const blackInitialRating = game.blackPlayer.rating || 1500;
          
          // Determine the winner ID in the correct format for database
          let winnerId: string | undefined = undefined;
          if (status === 'white_win') {
            winnerId = game.whitePlayer.userId;
          } else if (status === 'black_win') {
            winnerId = game.blackPlayer.userId;
          }
          
          const gameData = {
            id: dbId,
            whitePlayerId: game.whitePlayer.userId,
            blackPlayerId: game.blackPlayer.userId,
            winnerId: winnerId,
            status: status as 'ongoing' | 'white_win' | 'black_win' | 'draw' | 'aborted',
            endReason: dbEndReason,
            pgn: game.pgn,
            moves: formattedMoves,
            totalMoves: totalMoves,
            rated: game.rated,
            whitePlayerRating: whiteInitialRating,
            blackPlayerRating: blackInitialRating,
            whitePlayerRatingAfter: whiteRatingChange?.newRating,
            blackPlayerRatingAfter: blackRatingChange?.newRating,
            timeControl: game.timeControl
          };
          
          await this.gameRepositoryService.create(gameData);
          this.logger.log(`Game ${dbId} created with final state in database`);
        }
      }
    } catch (error) {
      this.logger.error(`Error persisting game result to database: ${error.message}`, error.stack);
    }

    this.cleanupGame(gameId);

    return finalResultData;
  }

  /**
   * Clean up a game from memory
   */
  private cleanupGame(gameId: string): void {
    const game = this.activeGames.get(gameId);
    if (!game) return;
    
    // Remove player to game mappings
    this.playerGameMap.delete(game.whitePlayer.socketId);
    this.playerGameMap.delete(game.blackPlayer.socketId);
    
    // Remove game
    this.activeGames.delete(gameId);
    
    this.logger.log(`Game ${gameId} cleaned up from memory`);
  }

  /**
   * Get all active games
   */
  getAllActiveGames(): GameState[] {
    return Array.from(this.activeGames.values());
  }
} 