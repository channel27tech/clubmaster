import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TimerService } from './timer/timer.service';

interface PlayerConnection {
  playerId: string;
  gameId: string;
  socketId: string;
  disconnectedAt: number | null;
  isReconnecting: boolean;
  reconnectionTimeout: NodeJS.Timeout | null;
}

interface GameState {
  gameId: string;
  playerIds: string[];
  hasWhiteMoved: boolean;
  isGameOver: boolean;
  disconnectedPlayers: Set<string>;
}

@Injectable()
export class DisconnectionService {
  private readonly logger = new Logger(DisconnectionService.name);
  
  // Track player connections
  private playerConnections: Map<string, PlayerConnection> = new Map();
  
  // Track game states
  private gameStates: Map<string, GameState> = new Map();
  
  // Reconnection time limit (in milliseconds)
  private readonly RECONNECT_TIME_LIMIT = 120000; // 2 minutes
  
  constructor(private readonly timerService: TimerService) {}

  /**
   * Initialize a game state when a game starts
   */
  initializeGame(gameId: string, playerIds: string[]): void {
    this.logger.log(`Initializing game state for game ${gameId}`);
    
    // Create game state
    this.gameStates.set(gameId, {
      gameId,
      playerIds,
      hasWhiteMoved: false,
      isGameOver: false,
      disconnectedPlayers: new Set(),
    });
    
    // Clear any existing player connections for these players
    playerIds.forEach(playerId => {
      const existingConnection = this.playerConnections.get(playerId);
      if (existingConnection) {
        this.clearReconnectionTimeout(existingConnection);
      }
      
      // Initialize player connection
      this.playerConnections.set(playerId, {
        playerId,
        gameId,
        socketId: '',  // Will be set when the player connects
        disconnectedAt: null,
        isReconnecting: false,
        reconnectionTimeout: null,
      });
    });
    
    this.logger.log(`Game ${gameId} initialized with players: ${playerIds.join(', ')}`);
  }

  /**
   * Register a player's socket connection
   */
  registerPlayerConnection(playerId: string, socketId: string): void {
    const connection = this.playerConnections.get(playerId);
    if (!connection) {
      this.logger.warn(`Attempted to register connection for unknown player: ${playerId}`);
      return;
    }
    
    connection.socketId = socketId;
    connection.disconnectedAt = null;
    connection.isReconnecting = false;
    
    // Clear any existing reconnection timeout
    this.clearReconnectionTimeout(connection);
    
    this.logger.log(`Registered socket connection for player ${playerId}: ${socketId}`);
  }

  /**
   * Handle a player disconnection
   */
  handlePlayerDisconnect(server: Server, socketId: string): void {
    // Find the player by socket ID
    let playerId: string | null = null;
    let gameId: string | null = null;
    
    for (const [id, connection] of this.playerConnections.entries()) {
      if (connection.socketId === socketId) {
        playerId = id;
        gameId = connection.gameId;
        break;
      }
    }
    
    if (!playerId || !gameId) {
      this.logger.warn(`Unknown socket disconnected: ${socketId}`);
      return;
    }
    
    const connection = this.playerConnections.get(playerId);
    const gameState = this.gameStates.get(gameId);
    
    if (!connection || !gameState) {
      this.logger.warn(`Missing connection or game state for player ${playerId}`);
      return;
    }
    
    // Mark player as disconnected
    connection.disconnectedAt = Date.now();
    connection.isReconnecting = true;
    gameState.disconnectedPlayers.add(playerId);
    
    // Get the reconnection time limit (either 2 minutes or remaining time on clock, whichever is less)
    let reconnectTimeLimit = this.RECONNECT_TIME_LIMIT;
    
    // Get the game timer state
    const timerState = this.timerService.getTimerState(gameId);
    if (timerState) {
      // Pause the timer after 10 seconds if the player doesn't reconnect
      setTimeout(() => {
        if (connection.isReconnecting) {
          this.logger.log(`Pausing timer for game ${gameId} due to player ${playerId} disconnection`);
          this.timerService.pauseTimer(gameId);
        }
      }, 10000); // 10 seconds
      
      // Use the player's remaining time if it's less than the default reconnection time
      const isWhitePlayer = gameState.playerIds.indexOf(playerId) === 0;
      const remainingTimeMs = isWhitePlayer ? timerState.whiteTimeMs : timerState.blackTimeMs;
      reconnectTimeLimit = Math.min(reconnectTimeLimit, remainingTimeMs);
    }
    
    // Convert to seconds for the client
    const reconnectTimeoutSeconds = Math.floor(reconnectTimeLimit / 1000);
    
    // Notify the opponent
    const opponentId = gameState.playerIds.find(id => id !== playerId);
    if (opponentId) {
      const opponentConnection = this.playerConnections.get(opponentId);
      if (opponentConnection && opponentConnection.socketId) {
        server.to(opponentConnection.socketId).emit('opponent_disconnected', {
          gameId,
          playerId,
          reconnectTimeoutSeconds,
        });
      }
    }
    
    // Set reconnection timeout
    connection.reconnectionTimeout = setTimeout(() => {
      this.handleReconnectionTimeout(server, playerId, gameId);
    }, reconnectTimeLimit);
    
    this.logger.log(`Player ${playerId} disconnected from game ${gameId}. Reconnection window: ${reconnectTimeoutSeconds}s`);
  }

  /**
   * Handle a player reconnection
   */
  handlePlayerReconnect(server: Server, playerId: string, socketId: string): void {
    const connection = this.playerConnections.get(playerId);
    if (!connection) {
      this.logger.warn(`Reconnection attempt from unknown player: ${playerId}`);
      return;
    }
    
    const gameId = connection.gameId;
    const gameState = this.gameStates.get(gameId);
    
    if (!gameState) {
      this.logger.warn(`Game state not found for reconnecting player ${playerId}`);
      return;
    }
    
    // Clear reconnection timeout
    this.clearReconnectionTimeout(connection);
    
    // Update connection status
    connection.socketId = socketId;
    connection.disconnectedAt = null;
    connection.isReconnecting = false;
    gameState.disconnectedPlayers.delete(playerId);
    
    // Resume the game timer if all players are connected
    if (gameState.disconnectedPlayers.size === 0 && !gameState.isGameOver) {
      this.timerService.startTimer(gameId);
    }
    
    // Notify the opponent
    const opponentId = gameState.playerIds.find(id => id !== playerId);
    if (opponentId) {
      const opponentConnection = this.playerConnections.get(opponentId);
      if (opponentConnection && opponentConnection.socketId) {
        server.to(opponentConnection.socketId).emit('opponent_reconnected', {
          gameId,
          playerId,
        });
      }
    }
    
    this.logger.log(`Player ${playerId} reconnected to game ${gameId}`);
  }

  /**
   * Handle a player's request to abort a game
   */
  handleAbortRequest(server: Server, playerId: string, gameId: string): boolean {
    const gameState = this.gameStates.get(gameId);
    
    if (!gameState) {
      this.logger.warn(`Abort request for unknown game: ${gameId}`);
      return false;
    }
    
    // Check if the player is part of this game
    if (!gameState.playerIds.includes(playerId)) {
      this.logger.warn(`Player ${playerId} is not part of game ${gameId}`);
      return false;
    }
    
    // Check if the game can be aborted (before white's first move)
    if (gameState.hasWhiteMoved) {
      this.logger.warn(`Cannot abort game ${gameId}: white has already moved`);
      return false;
    }
    
    // Check if the game is already over
    if (gameState.isGameOver) {
      this.logger.warn(`Cannot abort game ${gameId}: game is already over`);
      return false;
    }
    
    // Abort the game
    this.abortGame(server, gameId, 'Player requested game abort');
    return true;
  }

  /**
   * Abort a game and notify all players
   */
  abortGame(server: Server, gameId: string, reason: string): void {
    const gameState = this.gameStates.get(gameId);
    
    if (!gameState) {
      this.logger.warn(`Cannot abort unknown game: ${gameId}`);
      return;
    }
    
    // Mark game as over
    gameState.isGameOver = true;
    
    // Stop the game timer
    this.timerService.cleanupTimer(gameId);
    
    // Notify all players
    gameState.playerIds.forEach(playerId => {
      const connection = this.playerConnections.get(playerId);
      if (connection && connection.socketId) {
        server.to(connection.socketId).emit('game_aborted', {
          gameId,
          reason,
        });
      }
    });
    
    this.logger.log(`Game ${gameId} aborted. Reason: ${reason}`);
  }

  /**
   * Handle a server restart (planned or unplanned)
   */
  handleServerRestart(server: Server): void {
    this.logger.log('Handling server restart - aborting all active games');
    
    // Abort all active games
    for (const [gameId, gameState] of this.gameStates.entries()) {
      if (!gameState.isGameOver) {
        this.abortGame(server, gameId, 'Server restart');
      }
    }
    
    // Clear all timeouts
    for (const connection of this.playerConnections.values()) {
      this.clearReconnectionTimeout(connection);
    }
    
    // Clear all data
    this.playerConnections.clear();
    this.gameStates.clear();
  }

  /**
   * Update the game state when white makes the first move
   */
  markWhiteFirstMove(gameId: string): void {
    const gameState = this.gameStates.get(gameId);
    
    if (!gameState) {
      this.logger.warn(`Cannot mark white move for unknown game: ${gameId}`);
      return;
    }
    
    gameState.hasWhiteMoved = true;
    this.logger.log(`White made first move in game ${gameId}`);
  }

  /**
   * Handle when a player's reconnection time limit is reached
   */
  private handleReconnectionTimeout(server: Server, playerId: string, gameId: string): void {
    const connection = this.playerConnections.get(playerId);
    const gameState = this.gameStates.get(gameId);
    
    if (!connection || !gameState) {
      return;
    }
    
    // Clear the timeout reference
    connection.reconnectionTimeout = null;
    
    // Check if the player is still disconnected
    if (!connection.isReconnecting) {
      return;
    }
    
    // Mark game as over
    gameState.isGameOver = true;
    
    // Find the opponent
    const opponentId = gameState.playerIds.find(id => id !== playerId);
    
    if (!opponentId) {
      this.logger.error(`Cannot find opponent for player ${playerId} in game ${gameId}`);
      return;
    }
    
    // Emit game timeout event to all players
    server.to(gameId).emit('game_timeout_disconnection', {
      gameId,
      winnerId: opponentId,
      loserId: playerId,
      reason: 'Player disconnected and failed to reconnect in time',
    });
    
    // Cleanup the timer
    this.timerService.cleanupTimer(gameId);
    
    this.logger.log(`Player ${playerId} failed to reconnect in time to game ${gameId}`);
  }

  /**
   * Clear any reconnection timeout for a player
   */
  private clearReconnectionTimeout(connection: PlayerConnection): void {
    if (connection.reconnectionTimeout) {
      clearTimeout(connection.reconnectionTimeout);
      connection.reconnectionTimeout = null;
    }
  }
} 