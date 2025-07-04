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
import { BetService } from '../bet/bet.service';
import { GameNotificationHelper } from './game-notification.helper';

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
    ratingChange?: number;
  };
  blackPlayer: {
    userId?: string;
    username: string;
    isGuest: boolean;
    rating?: number;
    ratingChange?: number;
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
  
  // Socket.io server instance
  private server: Server;

  constructor(
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly usersService: UsersService,
    private readonly betService: BetService,
    private readonly gameNotificationHelper: GameNotificationHelper,
  ) {}
  
  /**
   * Set the Socket.io server instance
   * This should be called by the websocket gateway after initialization
   */
  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Server instance set in GameManagerService');
  }
  
  /**
   * Get the Socket.io server instance
   */
  getServer(): Server | null {
    if (!this.server) {
      this.logger.warn('Server instance not set in GameManagerService');
      return null;
    }
    return this.server;
  }

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
    try {
      this.logger.log(
        `Creating game ${gameId} - White: ${whitePlayer.socketId}${whitePlayer.userId ? ` (${whitePlayer.userId})` : ' (guest)'}, ` +
        `Black: ${blackPlayer.socketId}${blackPlayer.userId ? ` (${blackPlayer.userId})` : ' (guest)'}, ` +
        `Mode: ${gameMode}, Time: ${timeControl}, Rated: ${rated}`
      );
      
      // Validate input parameters
      if (!gameId || !whitePlayer || !blackPlayer || !gameMode || !timeControl) {
        this.logger.error(`Invalid parameters for game creation: gameId=${gameId}`);
        throw new Error('Invalid parameters for game creation');
      }
      
      // Ensure socketIds are present
      if (!whitePlayer.socketId || !blackPlayer.socketId) {
        this.logger.error(`Missing socketId for players in game ${gameId}`);
        throw new Error('Missing socketId for players');
      }

      // Parse time control string (e.g., '5+0' for 5 minutes with 0 increment)
      const [baseMinutes] = timeControl.split('+').map(Number);
      
      // Validate time control format
      if (isNaN(baseMinutes)) {
        this.logger.error(`Invalid time control format: ${timeControl}`);
        throw new Error(`Invalid time control format: ${timeControl}`);
      }
      
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
      
      this.logger.log(`Game created successfully: ${gameId}`);
      
      // Immediately persist the game to the database
      // But don't wait for it to complete - we'll handle errors in the persistGameToDatabase method
      this.persistGameToDatabase(gameState).catch(error => {
        this.logger.error(`Failed to persist game to database: ${error.message}`, error.stack);
        // Note: We don't throw here because we want the game to be playable even if DB persistence fails
      });
      
      return gameState;
    } catch (error) {
      this.logger.error(`Error creating game ${gameId}: ${error.message}`, error.stack);
      
      // Clean up any partial game state that might have been created
      if (this.activeGames.has(gameId)) {
        this.activeGames.delete(gameId);
      }
      
      // Clean up player mappings if they were created
      if (whitePlayer?.socketId && this.playerGameMap.has(whitePlayer.socketId)) {
        this.playerGameMap.delete(whitePlayer.socketId);
      }
      
      if (blackPlayer?.socketId && this.playerGameMap.has(blackPlayer.socketId)) {
        this.playerGameMap.delete(blackPlayer.socketId);
      }
      
      throw error; // Re-throw for the caller to handle
    }
  }
  
  /**
   * Persist a game to the database
   */
  private async persistGameToDatabase(game: GameState): Promise<void> {
    try {
      // Only persist games with registered players (not guests)
      if (game.whitePlayer.userId && game.blackPlayer.userId && 
          !game.whitePlayer.isGuest && !game.blackPlayer.isGuest) {
        
        this.logger.log(`Persisting game ${game.gameId} to database`);
        
        // Create the game in the database
        const dbGame = await this.gameRepositoryService.create({
          id: game.gameId, // Use the same ID for consistency
          whitePlayerId: game.whitePlayer.userId,
          blackPlayerId: game.blackPlayer.userId,
          status: 'ongoing',
          rated: game.rated,
          whitePlayerRating: game.whitePlayer.rating || 1500,
          blackPlayerRating: game.blackPlayer.rating || 1500,
          timeControl: game.timeControl,
          pgn: game.pgn,
          moves: [],
          totalMoves: 0
        });
        
        // Store the database ID in the game state
        if (dbGame) {
          game.dbGameId = dbGame.id;
          this.logger.log(`Game ${game.gameId} persisted to database with ID ${game.dbGameId}`);
        }
      } else {
        this.logger.log(`Skipping database persistence for game ${game.gameId} - one or both players are guests or missing user IDs`);
      }
    } catch (error) {
      this.logger.error(`Error persisting game to database: ${error.message}`, error.stack);
      throw error; // Re-throw for the caller to handle
    }
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
    // BET LOG: Move received
    if (game.gameMode && game.gameMode.toLowerCase().includes('bet')) {
      this.logger.log(`[bet] Move received: gameId=${gameId}, move=${move}, socketId=${socketId}`);
    }
    // Helper to get userId from socketId
    const getUserIdBySocket = (sid: string): string | undefined => {
      if (game.whitePlayer.socketId === sid) return game.whitePlayer.userId;
      if (game.blackPlayer.socketId === sid) return game.blackPlayer.userId;
      return undefined;
    };
    // Validate that it's the player's turn (allow by socketId or userId)
    let isValidTurn = false;
    if (game.whiteTurn) {
      isValidTurn = (game.whitePlayer.socketId === socketId);
      if (!isValidTurn && game.whitePlayer.userId && getUserIdBySocket(socketId) === game.whitePlayer.userId) {
        isValidTurn = true;
      }
    } else {
      isValidTurn = (game.blackPlayer.socketId === socketId);
      if (!isValidTurn && game.blackPlayer.userId && getUserIdBySocket(socketId) === game.blackPlayer.userId) {
        isValidTurn = true;
      }
    }
    if (!isValidTurn) {
      if (game.gameMode && game.gameMode.toLowerCase().includes('bet')) {
        this.logger.warn(`[bet] Move rejected (not player's turn): gameId=${gameId}, move=${move}, socketId=${socketId}`);
      }
      this.logger.warn(`[makeMove] Move rejected: Not player's turn. gameId=${gameId}, expectedSocket=${game.whiteTurn ? game.whitePlayer.socketId : game.blackPlayer.socketId}, gotSocket=${socketId}, expectedUserId=${game.whiteTurn ? game.whitePlayer.userId : game.blackPlayer.userId}, gotUserId=${getUserIdBySocket(socketId)}`);
      return false;
    }
    try {
      // Make the move
      const result = game.chessInstance.move(move) as Move | null;
      if (!result) {
        if (game.gameMode && game.gameMode.toLowerCase().includes('bet')) {
          this.logger.warn(`[bet] Move rejected (invalid move): gameId=${gameId}, move=${move}, socketId=${socketId}`);
        }
        this.logger.warn(`[makeMove] Move rejected: Invalid move string. gameId=${gameId}, move=${move}`);
        return false;
      }
      // BET LOG: Move accepted
      if (game.gameMode && game.gameMode.toLowerCase().includes('bet')) {
        this.logger.log(`[bet] Move accepted: gameId=${gameId}, move=${move}, socketId=${socketId}`);
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
                    this.logger.log(`Starting rating updates for game ${gameId}:`);
                    this.logger.log(`White player (${game.whitePlayer.username}, ID: ${game.whitePlayer.userId}): ${whiteRating} → ${whiteRatingChange.newRating} (${whiteRatingChange.ratingChange > 0 ? '+' : ''}${whiteRatingChange.ratingChange})`);
                    this.logger.log(`Black player (${game.blackPlayer.username}, ID: ${game.blackPlayer.userId}): ${blackRating} → ${blackRatingChange.newRating} (${blackRatingChange.ratingChange > 0 ? '+' : ''}${blackRatingChange.ratingChange})`);
                    
                    try {
                        // Find both users by their IDs (could be Firebase UIDs or database UUIDs)
                        this.logger.log(`Looking up white player with ID: ${game.whitePlayer.userId}`);
                        let whiteUser = await this.usersService.findUserByAnyId(game.whitePlayer.userId);
                        
                        this.logger.log(`Looking up black player with ID: ${game.blackPlayer.userId}`);
                        let blackUser = await this.usersService.findUserByAnyId(game.blackPlayer.userId);
                        
                        // Log results of user lookups
                        if (!whiteUser) {
                            this.logger.error(`White player not found with ID: ${game.whitePlayer.userId}`);
                        } else {
                            this.logger.log(`Found white player: ${whiteUser.displayName || whiteUser.username || 'Unknown'} (DB ID: ${whiteUser.id}, Firebase UID: ${whiteUser.firebaseUid || 'None'}, Current Rating: ${whiteUser.rating})`);
                        }
                        
                        if (!blackUser) {
                            this.logger.error(`Black player not found with ID: ${game.blackPlayer.userId}`);
                        } else {
                            this.logger.log(`Found black player: ${blackUser.displayName || blackUser.username || 'Unknown'} (DB ID: ${blackUser.id}, Firebase UID: ${blackUser.firebaseUid || 'None'}, Current Rating: ${blackUser.rating})`);
                        }
                        
                        if (whiteUser && blackUser) {
                            // Update white player's rating - use database ID, not Firebase UID
                            this.logger.log(`Updating white player rating: DB ID ${whiteUser.id} from ${whiteUser.rating} to ${whiteRatingChange.newRating}`);
                            try {
                                const updatedWhitePlayer = await this.usersService.updateRating(whiteUser.id, whiteRatingChange.newRating);
                                this.logger.log(`White player rating updated successfully. User: ${updatedWhitePlayer.displayName || updatedWhitePlayer.username}, Old rating: ${whiteRating}, New rating: ${updatedWhitePlayer.rating}`);
                                
                                // Verify the rating was actually updated
                                const verifyWhiteUpdate = await this.usersService.findOne(whiteUser.id);
                                if (verifyWhiteUpdate && verifyWhiteUpdate.rating === whiteRatingChange.newRating) {
                                    this.logger.log(`✅ Verified white player rating update: ${whiteRating} → ${verifyWhiteUpdate.rating}`);
                                } else {
                                    this.logger.error(`❌ White player rating verification failed! Expected: ${whiteRatingChange.newRating}, Actual: ${verifyWhiteUpdate?.rating || 'unknown'}`);
                                }
                            } catch (error) {
                                this.logger.error(`Error updating white player rating: ${error.message}`, error.stack);
                            }
                        
                            // Update black player's rating - use database ID, not Firebase UID
                            this.logger.log(`Updating black player rating: DB ID ${blackUser.id} from ${blackUser.rating} to ${blackRatingChange.newRating}`);
                            try {
                                const updatedBlackPlayer = await this.usersService.updateRating(blackUser.id, blackRatingChange.newRating);
                                this.logger.log(`Black player rating updated successfully. User: ${updatedBlackPlayer.displayName || updatedBlackPlayer.username}, Old rating: ${blackRating}, New rating: ${updatedBlackPlayer.rating}`);
                                
                                // Verify the rating was actually updated
                                const verifyBlackUpdate = await this.usersService.findOne(blackUser.id);
                                if (verifyBlackUpdate && verifyBlackUpdate.rating === blackRatingChange.newRating) {
                                    this.logger.log(`✅ Verified black player rating update: ${blackRating} → ${verifyBlackUpdate.rating}`);
                                } else {
                                    this.logger.error(`❌ Black player rating verification failed! Expected: ${blackRatingChange.newRating}, Actual: ${verifyBlackUpdate?.rating || 'unknown'}`);
                                }
                            } catch (error) {
                                this.logger.error(`Error updating black player rating: ${error.message}`, error.stack);
                            }
                        
                            // Update game statistics based on result - use database IDs
                            this.logger.log(`Updating game statistics based on result: ${gameEndDetails.result}`);
                            try {
                                if (gameEndDetails.result === GameResult.WHITE_WINS) {
                                    await this.usersService.incrementGameStats(whiteUser.id, 'win');
                                    await this.usersService.incrementGameStats(blackUser.id, 'loss');
                                    this.logger.log(`Game stats updated: White player win, Black player loss`);
                                } else if (gameEndDetails.result === GameResult.BLACK_WINS) {
                                    await this.usersService.incrementGameStats(whiteUser.id, 'loss');
                                    await this.usersService.incrementGameStats(blackUser.id, 'win');
                                    this.logger.log(`Game stats updated: White player loss, Black player win`);
                                } else if (gameEndDetails.result === GameResult.DRAW) {
                                    await this.usersService.incrementGameStats(whiteUser.id, 'draw');
                                    await this.usersService.incrementGameStats(blackUser.id, 'draw');
                                    this.logger.log(`Game stats updated: Draw for both players`);
                                }
                            } catch (error) {
                                this.logger.error(`Error updating game statistics: ${error.message}`, error.stack);
                            }
                        } else {
                            this.logger.error(`Could not update ratings because one or both users were not found in the database`);
                        }
                        
                        // Store ratings in the game record
                        this.logger.log(`Finding game record in database for ID: ${gameId}`);
                        // Try to find the game by its database ID if available
                        const dbId = game.dbGameId || gameId;
                        const dbGame = await this.gameRepositoryService.findOne(dbId);
                        
                        if (dbGame) {
                            this.logger.log(`Found game record with ID: ${dbGame.id}. Updating with rating information.`);
                            try {
                                // Update game with both before and after ratings
                                await this.gameRepositoryService.update(dbGame.id, {
                                    whitePlayerRating: whiteRating,
                                    blackPlayerRating: blackRating,
                                    whitePlayerRatingAfter: whiteRatingChange.newRating,
                                    blackPlayerRatingAfter: blackRatingChange.newRating
                                });
                                this.logger.log(`Game ${dbGame.id} updated with rating information in database`);
                                
                                // Double-check that the ratings were saved
                                const verifyGame = await this.gameRepositoryService.findOne(dbGame.id);
                                if (verifyGame) {
                                    this.logger.log(`Verified game ratings in database: White: ${verifyGame.whitePlayerRating} → ${verifyGame.whitePlayerRatingAfter}, Black: ${verifyGame.blackPlayerRating} → ${verifyGame.blackPlayerRatingAfter}`);
                                }
                            } catch (error) {
                                this.logger.error(`Error updating game record with rating information: ${error.message}`, error.stack);
                            }
                        } else {
                            this.logger.warn(`Could not find game record for ID: ${dbId}. Rating information not saved to game record.`);
                        }
                    } catch (error) {
                        this.logger.error(`Error updating ratings in database: ${error.message}`, error.stack);
                        // Continue execution even if rating updates fail - we don't want to block the game end process
                    }
                } else {
                    this.logger.warn(`Cannot update ratings: Missing user IDs. White player ID: ${game.whitePlayer.userId}, Black player ID: ${game.blackPlayer.userId}`);
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
        ratingChange: whiteRatingChange?.ratingChange || 0,
      },
      blackPlayer: {
        userId: game.blackPlayer.userId,
        username: game.blackPlayer.username,
        isGuest: game.blackPlayer.isGuest,
        rating: game.blackPlayer.rating,
        ratingChange: blackRatingChange?.ratingChange || 0,
      },
    };

    this.logger.log(`Emitting 'game_ended' for ${gameId} with data:`, JSON.stringify(finalResultData, null, 2));
    server.to(gameId).emit('game_ended', finalResultData);
    
    // Handle bet result if there is a bet associated with this game
    await this.handleBetResult(gameId, gameEndDetails);

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

    // Send game aborted notifications if appropriate
    if (gameEndDetails.reason === GameEndReason.TIMEOUT || 
        gameEndDetails.reason === GameEndReason.ABANDON ||
        gameEndDetails.reason === GameEndReason.ABORT) {
      try {
        // Send notifications to both players if they're registered (not guests)
        if (game.whitePlayer.userId) {
          await this.gameNotificationHelper.sendGameAbortedNotification(
            game.whitePlayer,
            gameId,
            gameEndDetails.reason,
          );
        }
        
        if (game.blackPlayer.userId) {
          await this.gameNotificationHelper.sendGameAbortedNotification(
            game.blackPlayer,
            gameId,
            gameEndDetails.reason,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send game aborted notifications: ${error.message}`);
        // Non-blocking - continue even if notifications fail
      }
    }

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

  /**
   * Helper method to validate UUID format
   */
  private isValidUuid(id: string): boolean {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
  
  /**
   * Handle bet result for a game if there is an associated bet
   */
  private async handleBetResult(
    gameId: string,
    gameEndDetails: GameEndDetails,
  ): Promise<void> {
    try {
      const game = this.activeGames.get(gameId);
      if (!game) {
        this.logger.warn(`Game not found in handleBetResult: ${gameId}`);
        return;
      }
      
      // Determine winner and if it's a draw
      let winnerId: string | null = null;
      const isDraw = gameEndDetails.result === GameResult.DRAW || gameEndDetails.result === GameResult.ABORTED;
      
      if (!isDraw && gameEndDetails.winnerSocketId) {
        // Get winner's user ID from the game state
        if (gameEndDetails.winnerSocketId === game.whitePlayer.socketId && game.whitePlayer.userId) {
          winnerId = game.whitePlayer.userId;
        } else if (gameEndDetails.winnerSocketId === game.blackPlayer.socketId && game.blackPlayer.userId) {
          winnerId = game.blackPlayer.userId;
        }
      }
      
      // Check if there is a bet associated with this game
      const betResult = await this.betService.recordBetResult(
        gameId,
        winnerId,
        isDraw,
      );
      
      if (betResult) {
        this.logger.log(`Processed bet result for game ${gameId}:`, betResult);
      } else {
        this.logger.log(`No bet found for game ${gameId} or error processing bet result`);
      }
    } catch (error) {
      this.logger.error(`Error handling bet result for game ${gameId}: ${error.message}`, error.stack);
    }
  }
} 