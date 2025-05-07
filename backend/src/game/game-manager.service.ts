import { Injectable, Logger } from '@nestjs/common';
import { Chess, Move } from 'chess.js';
import { Server } from 'socket.io';
import { 
  GameEndService, 
  GameEndDetails,
  GameEndReason,
  GameResult
} from './game-end/game-end.service';
import { RatingService, RatingResult, RatingChange } from './rating/rating.service';

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
}

// Game state type
export interface GameState {
  gameId: string;
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
  drawOfferBy?: string; // Socket ID of player who offered draw
}

// Result of a completed game
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
  
  // Map to store active games
  private activeGames: Map<string, GameState> = new Map();
  
  // Map to store player's active game ID
  private playerGameMap: Map<string, string> = new Map();
  
  // Reconnection grace period (in ms) - 2 minutes
  private readonly RECONNECTION_GRACE_PERIOD = 2 * 60 * 1000;

  constructor(
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
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
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Invalid move in game ${gameId}: ${move}`, error);
      return false;
    }
  }

  /**
   * Check if a game has ended due to chess rules
   */
  checkGameEnd(gameId: string, server: Server): GameResultData | null {
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
  ): GameResultData | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
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
  ): GameResultData | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
    // Determine which player resigned
    const resigningColor = game.whitePlayer.socketId === socketId ? 'w' : 'b';
    
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
      return this.handleGameEnd(gameId, gameEndDetails, server);
    }
    
    return null;
  }

  /**
   * Register a draw agreement in a game
   */
  registerDrawAgreement(gameId: string, server: Server): GameResultData | null {
    const game = this.activeGames.get(gameId);
    if (!game || game.ended) return null;
    
    // Check game end based on draw agreement
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chessInstance,
      game.whitePlayer.socketId,
      game.blackPlayer.socketId,
      undefined, // No timeout
      undefined, // No resignation
      true, // Draw agreement
      undefined, // No disconnection
      game.isFirstMove,
    );
    
    if (gameEndDetails) {
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
      
      if (disconnectDuration >= effectiveGracePeriod) {
        // Grace period expired, treat as abandonment
        const gameEndDetails = this.gameEndService.checkGameEnd(
          game.chessInstance,
          game.whitePlayer.socketId,
          game.blackPlayer.socketId,
          undefined, // No timeout
          undefined, // No resignation
          false, // No draw agreement
          disconnectedColor, // Disconnected player's color
          game.isFirstMove,
        );
        
        if (gameEndDetails) {
          this.handleGameEnd(gameId, gameEndDetails, server);
        }
      }
    }
  }

  /**
   * Handle game end logic
   */
  private handleGameEnd(
    gameId: string,
    gameEndDetails: GameEndDetails,
    server: Server,
  ): GameResultData {
    const game = this.activeGames.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }
    
    // Mark game as ended
    game.ended = true;
    game.endTime = new Date();
    game.result = gameEndDetails.result;
    game.endReason = gameEndDetails.reason;
    
    // Calculate rating changes if:
    // 1. The game is rated
    // 2. Both players are registered (not guests)
    // 3. The game wasn't aborted
    let whiteRatingChange: RatingChange | undefined;
    let blackRatingChange: RatingChange | undefined;
    
    if (
      game.rated &&
      !game.whitePlayer.isGuest &&
      !game.blackPlayer.isGuest &&
      gameEndDetails.result !== GameResult.ABORTED
    ) {
      // Determine the result for white player
      let whiteResult: RatingResult;
      
      switch (gameEndDetails.result) {
        case GameResult.WHITE_WINS:
          whiteResult = RatingResult.WIN;
          break;
        case GameResult.BLACK_WINS:
          whiteResult = RatingResult.LOSS;
          break;
        case GameResult.DRAW:
          whiteResult = RatingResult.DRAW;
          break;
        default:
          whiteResult = RatingResult.DRAW;
      }
      
      // Calculate rating changes
      const ratingChanges = this.ratingService.calculateGameRatingChanges(
        game.whitePlayer.rating || 1500,
        game.blackPlayer.rating || 1500,
        whiteResult,
        game.whitePlayer.gamesPlayed || 0,
        game.blackPlayer.gamesPlayed || 0,
      );
      
      whiteRatingChange = ratingChanges.white;
      blackRatingChange = ratingChanges.black;
    }
    
    // Create game result data for database storage and client notification
    const resultData: GameResultData = {
      gameId: game.gameId,
      result: gameEndDetails.result,
      reason: gameEndDetails.reason,
      winnerUserId: gameEndDetails.winnerSocketId
        ? game.whitePlayer.socketId === gameEndDetails.winnerSocketId
          ? game.whitePlayer.userId
          : game.blackPlayer.userId
        : undefined,
      loserUserId: gameEndDetails.loserSocketId
        ? game.whitePlayer.socketId === gameEndDetails.loserSocketId
          ? game.whitePlayer.userId
          : game.blackPlayer.userId
        : undefined,
      whiteRatingChange,
      blackRatingChange,
      pgn: game.pgn,
      gameMode: game.gameMode,
      timeControl: game.timeControl,
      rated: game.rated,
      startTime: game.startTime,
      endTime: game.endTime,
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
    
    // Notify players of game end
    server.to(gameId).emit('gameEnd', resultData);
    
    // TODO: Save game result to database (will be implemented by another service)
    
    // Clean up game after a delay
    setTimeout(
      () => {
        this.cleanupGame(gameId);
      },
      5 * 60 * 1000,
    ); // Clean up after 5 minutes
    
    this.logger.log(
      `Game ${gameId} ended: ${gameEndDetails.result} due to ${gameEndDetails.reason}`,
    );
    
    return resultData;
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