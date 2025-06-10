import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import { MatchmakingService } from '../game/matchmaking.service';
import { GameManagerService } from '../game/game-manager.service';
import { GameEndService, GameEndReason, GameResult } from '../game/game-end/game-end.service';
import { RatingService, RatingResult } from '../game/rating/rating.service';
import { DisconnectionService } from '../game/disconnection.service';
import { JoinGameDto } from '../game/dto/join-game.dto';
import { UsersService } from '../users/users.service';
import { GameRepositoryService } from '../game/game-repository.service';
import { UserActivityService } from '../users/user-activity.service';

// Define an interface for the matchmaking options
interface MatchmakingOptions {
  gameMode?: string;
  timeControl?: string;
  rated?: boolean;
  preferredSide?: string;
}

// Define an interface for the move_made payload
interface MoveMadePayload {
  gameId: string;
  from?: string; // Optional now since we can use SAN notation instead
  to?: string; // Optional now since we can use SAN notation instead
  player: string;
  notation?: string; // Legacy field for backward compatibility
  san?: string; // Standard Algebraic Notation (e.g., "e4", "Nf3")
  promotion?: string; // Add optional promotion field
  isCapture?: boolean; // Already being added, but good to have in type if strict
  fen?: string; // Legacy field for backward compatibility
  currentFen?: string; // FEN before the move
  resultingFen?: string; // FEN after the move
  moveHistory?: string[]; // Move history for verification
}

// Add this mapping   of piece types to their corresponding chess.js notation
const pieceTypeToChessJs: Record<string, string | undefined> = {
  'queen': 'q',
  'rook': 'r',
  'bishop': 'b',
  'knight': 'n',
};

// Define the WebSocketGateway for the game
@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'chess',
  transports: ['websocket'],
})

// Define the GameGateway class that implements the OnGatewayInit, OnGatewayConnection, and OnGatewayDisconnect interfaces
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('GameGateway');
  // Map to store chess instances by game ID for consistent state management
  private chessInstances: Map<string, Chess> = new Map();

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly gameManagerService: GameManagerService,
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
    private readonly disconnectionService: DisconnectionService,
    private readonly usersService: UsersService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly userActivityService: UserActivityService
  ) {}

  /**
   * Helper method to safely get a socket by ID
   * @param socketId The socket ID to find
   * @returns The socket if found, null otherwise
   */
  private safeGetSocket(socketId: string): Socket | null {
    try {
      if (this.server && this.server.sockets && this.server.sockets.sockets) {
        return this.server.sockets.sockets.get(socketId) || null;
      }
      this.logger.warn(`Cannot access socket collection when looking for socket ${socketId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error accessing socket ${socketId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * This method runs when the gateway is initialized
   */
  afterInit() {
    this.logger.log('Chess Game WebSocket Gateway Initialized');
    this.logger.warn('⚠ GAME STATE WARNING: All game state is stored in-memory only. Restarting the server will clear all active games.');
    
    // Set the server instance in the GameManagerService
    this.gameManagerService.setServer(this.server);
    this.logger.log('Server instance passed to GameManagerService');
  }

  /**
   * This method runs when a client connects
   */
  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    
    // Check if user is authenticated
    if (client.handshake?.auth?.uid) {
      // We don't mark as in-game yet, just register connection
      this.userActivityService.registerConnection(client.handshake.auth.uid, client.id);
    }
    
    // Check if this is a reconnecting player
    this.matchmakingService.handlePlayerReconnect(client.id);
    // Send a welcome message to the connected client
    client.emit('connectionEstablished', {
      message: 'Successfully connected to Chess Game server',
      clientId: client.id,
    });
  }

  /**
   * This method runs when a client disconnects
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Update user activity status if authenticated
    if (client.handshake?.auth?.uid) {
      this.userActivityService.registerDisconnection(client.id);
    }
    
    // Mark player as disconnected but give them time to reconnect
    this.matchmakingService.removePlayerFromQueue(client.id, true);
    // Give the client some time to reconnect before removing from queue
    setTimeout(() => {
      // Check if client has reconnected
      let isClientConnected = false;
      try {
        // In Socket.IO v4, we need to check if the socket exists in the server
        if (this.server && this.server.sockets && this.server.sockets.sockets) {
          isClientConnected = Array.from(this.server.sockets.sockets.values())
            .some(socket => socket.id === client.id);
        }
      } catch (error) {
        this.logger.error(`Error checking if client ${client.id} is connected: ${error.message}`);
      }
      
      if (!isClientConnected) {
        this.logger.log(`Client ${client.id} did not reconnect, removing from queue`);
        this.matchmakingService.removePlayerFromQueue(client.id);
      } else {
        this.logger.log(`Client ${client.id} reconnected successfully`);
      }
    }, 10000); // Wait 10 seconds before removing from queue
    
    // Register disconnection with game manager for ongoing games
    this.gameManagerService.registerDisconnection(client.id, this.server);
    
    // Handle disconnection for active games
    this.disconnectionService.handlePlayerDisconnect(this.server, client.id);
  }

  /**
   * Handle a client joining a game from the matchmaking queue
   */
  @SubscribeMessage('join_game')
  handleJoinGame(client: Socket, payload: JoinGameDto): { event: string; data: any } {
    const { gameType } = payload;
    
    this.logger.log(`Client ${client.id} is joining a game type: ${gameType}`);
    
    try {
      // Call the method but don't check its return value since it's void
      this.matchmakingService.addPlayerToQueue(client, {
        gameMode: gameType,
        timeControl: payload.timeControl || '5+0',
        rated: payload.rated !== undefined ? payload.rated : true,
        preferredSide: payload.preferredSide || 'random'
      });

      // Track user activity if auth is available
      if (client.handshake?.auth?.uid) {
        // Not in game yet, but update activity timestamp
        this.userActivityService.registerActivity(client.handshake.auth.uid);
      }
      
      // Always return success if no exception was thrown
      return {
        event: 'joinGameResponse',
        data: { success: true, message: 'Added to matchmaking queue' },
      };
    } catch (error) {
      return {
        event: 'joinGameResponse',
        data: { 
          success: false, 
          message: error instanceof Error ? error.message : 'An error occurred' 
        },
      };
    }
  }

  /**
   * Handle a client connecting to an existing game
   */
  @SubscribeMessage('enter_game')
  handleEnterGame(client: Socket, payload: { gameId: string }): { event: string; data: any } {
    this.logger.log(`Client ${client.id} is entering game ${payload.gameId}`);
    
    // Join the game room for all real-time updates
    client.join(payload.gameId);
    
    // Get the game state
    const game = this.gameManagerService.getGame(payload.gameId);
    
    // Track player activity if user auth is available
    if (client.handshake?.auth?.uid) {
      this.userActivityService.registerInGame(client.handshake.auth.uid, payload.gameId);
    }
    
    if (!game) {
      this.logger.warn(`Game ${payload.gameId} not found in gameManagerService - Games registry might be broken.`);
      
      // Log currently active games for debugging
      const activeGames = this.gameManagerService.getAllActiveGames();
      this.logger.log(`Currently registered games: ${activeGames.length}`);
      activeGames.forEach(g => {
        this.logger.log(`Game ID: ${g.gameId}, White: ${g.whitePlayer.socketId}, Black: ${g.blackPlayer.socketId}`);
      });
      
      return {
        event: 'enterGameResponse',
        data: { success: false, message: 'Game not found' },
      };
    }
    
    this.logger.log(`Game ${payload.gameId} found - White: ${game.whitePlayer.socketId}, Black: ${game.blackPlayer.socketId}`);
    
    // Initialize or get the chess instance for this game
    let chessInstance = this.chessInstances.get(payload.gameId);
    if (!chessInstance) {
      this.logger.log(`Creating new chess instance for game ${payload.gameId} during enter_game`);
      chessInstance = new Chess(); // Start with a fresh instance with correct move counts
      
      // If the game already has moves, rebuild the state from the move history
      if (game.chessInstance && game.chessInstance.history().length > 0) {
        const moveHistory = game.chessInstance.history();
        this.logger.log(`Rebuilding chess instance from ${moveHistory.length} moves in game history`);
        
        // Apply each move from the move history
        let allMovesApplied = true;
        for (let i = 0; i < moveHistory.length; i++) {
          try {
            const result = chessInstance.move(moveHistory[i]);
            if (!result) {
              this.logger.error(`Failed to apply move ${i+1} during rebuild: ${moveHistory[i]}`);
              allMovesApplied = false;
              break;
            }
          } catch (moveError) {
            this.logger.error(`Error applying move ${i+1} during rebuild: ${moveHistory[i]}. Error: ${moveError instanceof Error ? moveError.message : 'Unknown error'}`);
            allMovesApplied = false;
            break;
          }
        }
        
        if (!allMovesApplied) {
          // If we couldn't apply all moves, use the game's chess instance as fallback
          this.logger.warn(`Failed to rebuild board from move history. Using game's chess instance as fallback.`);
          chessInstance = game.chessInstance;
        } else {
          this.logger.log(`Successfully rebuilt board from move history. New FEN: ${chessInstance.fen()}`);
          // Update the game's chess instance with our rebuilt instance
          game.chessInstance = chessInstance;
        }
      } else if (game.chessInstance) {
        // If the game has a chess instance but no moves, just use it
        chessInstance = game.chessInstance;
      }
      
      // Store the chess instance for future use
      this.chessInstances.set(payload.gameId, chessInstance);
    }
    
    // Send initial game state that explicitly includes hasWhiteMoved status
    client.emit('game_state', {
      gameId: payload.gameId,
      hasWhiteMoved: !game.isFirstMove, // Inverse of isFirstMove
      isWhiteTurn: game.whiteTurn,
      hasStarted: game.started,
      isGameOver: game.ended,
      players: {
        white: {
          username: game.whitePlayer.username,
          rating: game.whitePlayer.rating,
          isGuest: game.whitePlayer.isGuest,
        },
        black: {
          username: game.blackPlayer.username,
          rating: game.blackPlayer.rating,
          isGuest: game.blackPlayer.isGuest,
        },
      },
    });
    
    // Send timeControl to client
    client.emit('time_control', {
      gameId: payload.gameId,
      timeControl: game.timeControl,
    });
    
    // Send board_updated event with move history as primary source of truth
    if (chessInstance && chessInstance.history().length > 0) {
      const moveHistory = chessInstance.history();
      const verboseMoveHistory = chessInstance.history({ verbose: true });
      
      client.emit('board_updated', {
        gameId: payload.gameId,
        moveHistory: moveHistory, // Primary source of truth
        verboseMoveHistory: verboseMoveHistory, // Detailed move information
        lastMove: moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null,
        fen: chessInstance.fen(), // Current FEN (for validation)
        pgn: chessInstance.pgn(), // PGN representation
        whiteTurn: game.whiteTurn, // Whose turn it is
        moveCount: moveHistory.length, // Total number of moves
        timestamp: Date.now() // Timestamp for synchronization
      });
    }
    
    return {
      event: 'enterGameResponse',
      data: { success: true, message: 'Joined game room' },
    };
  }

  /**
   * Handle a client request to start matchmaking
   */
  @SubscribeMessage('startMatchmaking')
  async handleStartMatchmaking(client: Socket, payload: { 
    gameMode?: string;
    timeControl?: string;
    rated?: boolean;
    preferredSide?: string;
    firebaseUid?: string;
    username?: string;
  }) {
    this.logger.log(
      `Client ${client.id} requested to start matchmaking: ${JSON.stringify(payload)}`,
    );
    
    try {
      // Extract player identification data
      const firebaseUid = payload.firebaseUid || 'guest';
      const username = payload.username || `Player-${client.id.substring(0, 5)}`;
      
      // If the user is registered (not a guest), fetch their data
      let userId: string | undefined;
      let rating = 1500; // Default rating
      let isGuest = true;
      
      if (firebaseUid !== 'guest') {
        try {
          // Fetch user from database using firebaseUid
          const user = await this.usersService.findByFirebaseUid(firebaseUid);
          
          if (user) {
            userId = user.id; // This is the UUID from the database
            rating = user.rating;
            isGuest = false;
            this.logger.log(`Found registered user: ${username} (${userId}), Rating: ${rating}`);
          } else {
            this.logger.warn(`Firebase user ${firebaseUid} not found in database, treating as guest`);
          }
        } catch (error) {
          this.logger.error(`Error fetching user data for ${firebaseUid}: ${error.message}`, error.stack);
        }
      } else {
        this.logger.log(`User is a guest: ${username}`);
      }
      
      // Add player to matchmaking queue with all the collected data
      this.matchmakingService.addPlayerToQueue(
        client,
        {
          gameMode: payload.gameMode || 'Blitz',
          timeControl: payload.timeControl || '5+0',
          rated: payload.rated !== undefined ? payload.rated : true,
          preferredSide: payload.preferredSide || 'random',
        },
        rating,
        userId,
        username,
        isGuest
      );
      
      return {
        event: 'matchmakingStarted',
        data: {
          success: true,
          message: 'Matchmaking started',
        },
      };
    } catch (error) {
      this.logger.error(`Error starting matchmaking for client ${client.id}:`, error);
      
      client.emit('matchmakingError', {
        message: 'Failed to start matchmaking',
        error: error.message,
      });
      
      return {
        event: 'matchmakingStarted',
        data: {
          success: false,
          message: 'Failed to start matchmaking',
          error: error.message,
        },
      };
    }
  }

  /**
   * Handle a client request to cancel matchmaking
   */
  @SubscribeMessage('cancelMatchmaking')
  handleCancelMatchmaking(client: Socket) {
    this.logger.log(`Client ${client.id} requested to cancel matchmaking`);
    
    try {
      // Remove player from matchmaking queue
      this.matchmakingService.removePlayerFromQueue(client.id);
      
      return {
        event: 'matchmakingCancelled',
        data: {
          success: true,
          message: 'Matchmaking cancelled',
        },
      };
    } catch (error) {
      this.logger.error(`Error cancelling matchmaking for client ${client.id}:`, error);
      
      return {
        event: 'matchmakingCancelled',
        data: {
          success: false,
          message: 'Failed to cancel matchmaking',
          error: error.message,
        },
      };
    }
  }

  /**
   * Handle a client making a move
   */
  @SubscribeMessage('make_move')
  async handleMakeMove(client: Socket, payload: { gameId: string; move: string }) {
    try {
      this.logger.log(
        `Client ${client.id} made move ${payload.move} in game ${payload.gameId}`,
      );
      
      // Check if the game exists before proceeding
      const gameExists = this.gameManagerService.getGame(payload.gameId);
      if (!gameExists) {
        // Enhanced debugging for missing game
        const allGames = this.gameManagerService.getAllActiveGames();
        this.logger.warn(`[GameGateway] Game ${payload.gameId} not found for make_move! Games keys: [${allGames.map(g => g.gameId).join(', ')}]`);
        
        return {
          event: 'moveMade',
          data: {
            success: false,
            message: 'Game not found in server registry',
          },
        };
      }
      
      // Have game manager process the move
      const moveSuccess = this.gameManagerService.makeMove(
        payload.gameId,
        payload.move,
        client.id,
      );
      
      if (moveSuccess) {
        // Get updated game state
        const game = this.gameManagerService.getGame(payload.gameId);
        
        if (game) {
          this.logger.log(`Move successfully processed for game ${payload.gameId}`);
          
          // Broadcast the move to all players in the game room
          this.server.to(payload.gameId).emit('move_made', {
            gameId: payload.gameId,
            move: payload.move,
            playerId: client.id,
            fen: game.chessInstance.fen(),
            pgn: game.pgn,
            isWhiteTurn: game.whiteTurn,
          });
          
          // Check for game end conditions like checkmate
          if (game.chessInstance.isCheckmate()) {
            this.logger.log(`Checkmate detected in game ${payload.gameId}`);
            const winnerColor = game.whiteTurn ? 'black' : 'white'; // The one who just moved
            const loserColor = game.whiteTurn ? 'white' : 'black'; // The one who got checkmated
            
            // Add additional logging for database ID
            this.logger.log(`Checkmate detected - database ID: ${game.dbGameId || 'not available'}, event gameId: ${payload.gameId}`);
            
            // Log the attempt to call checkGameEnd
            this.logger.log(`Calling checkGameEnd for checkmate in game ${payload.gameId}, database ID: ${game.dbGameId || 'not available'}`);
            
            try {
              // Call checkGameEnd to update the database record
              const resultData = await this.gameManagerService.checkGameEnd(
                payload.gameId,
                this.server
              );
              
              if (resultData) {
                this.logger.log(`Successfully handled game end for ${payload.gameId}`);
              } else {
                this.logger.warn(`checkGameEnd returned null for ${payload.gameId}, may need manual game end handling`);
                
                // Emit game_end event to clients as fallback
                this.server.to(payload.gameId).emit('game_end', {
                  result: 'checkmate',
                  reason: 'checkmate',
                  winnerColor: winnerColor,
                  loserColor: loserColor,
                  finalFEN: game.chessInstance.fen()
                });
              }
            } catch (error) {
              this.logger.error(`Error handling game end for ${payload.gameId}: ${error.message}`, error.stack);
              
              // Even if checkGameEnd fails, still emit the game_end event to clients
              this.server.to(payload.gameId).emit('game_end', {
                result: 'checkmate',
                reason: 'checkmate',
                winnerColor: winnerColor,
                loserColor: loserColor,
                finalFEN: game.chessInstance.fen()
              });
            }
          } else if (game.chessInstance.isDraw() || game.chessInstance.isStalemate() || 
                    game.chessInstance.isThreefoldRepetition() || game.chessInstance.isInsufficientMaterial()) {
            this.logger.log(`Draw detected in game ${payload.gameId}`);
            
            // Log the attempt to call checkGameEnd
            this.logger.log(`Calling checkGameEnd for draw in game ${payload.gameId}, database ID: ${game.dbGameId || 'not available'}`);
            
            try {
              // Call checkGameEnd to update the database record
              const resultData = await this.gameManagerService.checkGameEnd(
                payload.gameId,
                this.server
              );
              
              if (resultData) {
                this.logger.log(`Successfully handled game end for ${payload.gameId}`);
              } else {
                this.logger.warn(`checkGameEnd returned null for ${payload.gameId}, may need manual game end handling`);
                
                // Emit game_end event to clients as fallback
                this.server.to(payload.gameId).emit('game_end', {
                  result: 'draw',
                  reason: 'draw',
                  finalFEN: game.chessInstance.fen()
                });
              }
            } catch (error) {
              this.logger.error(`Error handling game end for ${payload.gameId}: ${error.message}`, error.stack);
              
              // Even if checkGameEnd fails, still emit the game_end event to clients
              this.server.to(payload.gameId).emit('game_end', {
                result: 'draw',
                reason: 'draw',
                finalFEN: game.chessInstance.fen()
              });
            }
          }
          
          return {
            event: 'moveMade',
            data: {
              success: true,
              message: 'Move made and game ended',
              gameEnd: true,
              result: game.chessInstance.isCheckmate() ? GameResult.WHITE_WINS : GameResult.DRAW,
            },
          };
        } else {
          this.logger.error(`Game ${payload.gameId} disappeared after successful move`);
          return {
            event: 'moveMade',
            data: {
              success: false,
              message: 'Game state lost after move',
            },
          };
        }
      } else {
        this.logger.warn(`Invalid move ${payload.move} attempted by client ${client.id} in game ${payload.gameId}`);
        return {
          event: 'moveMade',
          data: {
            success: false,
            message: 'Invalid move',
          },
        };
      }
    } catch (error) {
      this.logger.error(`Error processing move for game ${payload?.gameId}:`, error);
      return {
        event: 'moveMade',
        data: {
          success: false,
          message: 'Server error processing move',
          error: error.message
        },
      };
    }
  }

  /**
   * Handle a client resigning from a game
   */
  @SubscribeMessage('resign')
  async handleResign(client: Socket, payload: { gameId: string }) {
    try {
      this.logger.log(
        `Client ${client.id} resigned from game ${payload.gameId}`,
      );
      
      // First, check if the game exists and get its data
      const game = this.gameManagerService.getGame(payload.gameId);
      if (!game) {
        this.logger.error(`Game ${payload.gameId} not found for resignation event`);
        return {
          event: 'gameResigned',
          data: { success: false, message: 'Game not found' }
        };
      }

      // Make sure we have valid socket IDs for both players
      if (!game.whitePlayer?.socketId || !game.blackPlayer?.socketId) {
        this.logger.error(`Missing socket IDs for players in game ${payload.gameId}`);
        // Get any available socketId for valid fallback
        const anyWhiteSocketId = game.whitePlayer?.socketId || 'unknown-white';
        const anyBlackSocketId = game.blackPlayer?.socketId || 'unknown-black';
        
        // Log this critical error with available data
        this.logger.error(`Critical: Player socketIds missing: white=${anyWhiteSocketId}, black=${anyBlackSocketId}, resigner=${client.id}`);
      }
      
      // Explicitly identify winner and loser regardless of gameResult
      // This ensures both client-specific events will work correctly
      const isWhiteResigning = game.whitePlayer?.socketId === client.id;
      const winnerSocketId = isWhiteResigning ? 
        (game.blackPlayer?.socketId || 'unknown-black') : 
        (game.whitePlayer?.socketId || 'unknown-white');
      const loserSocketId = client.id; // Resigning player is always the loser
      
      this.logger.log(`Pre-resignation data - Winner: ${winnerSocketId}, Loser: ${loserSocketId}, isWhiteResigning: ${isWhiteResigning}`);
      
      // Now process the resignation with the game manager
      const gameResult = await this.gameManagerService.registerResignation(
        payload.gameId,
        client.id,
        this.server,
      );
      
      // If gameResult is null or undefined, handle it gracefully
      if (!gameResult) {
        this.logger.error(`Failed to register resignation - gameResult is ${gameResult}`);
        
        // Create a fallback gameResult using our explicitly determined winner/loser
        const fallbackResult = {
          winnerUserId: winnerSocketId,
          loserUserId: loserSocketId,
          gameId: payload.gameId,
          reason: 'resignation',
          isDraw: false
        };
        
        this.logger.log(`Using fallback game result: ${JSON.stringify(fallbackResult)}`);
        
        // Create consistent payload for all emissions with fallback data
        const resignPayload = {
          gameId: payload.gameId,
          reason: 'Player resigned',
          winner: winnerSocketId,
          loser: loserSocketId,
          winnerId: winnerSocketId, // Add redundant fields for compatibility
          loserId: loserSocketId,
          winnerSocketId, // Explicit naming for frontend
          loserSocketId,
          isWhiteResigning,
          resigning: false, // Will be overridden for resigning player
          result: 'unknown' // Will be overridden per player
        };
        
        // Broadcast to all clients
        this.server.to(payload.gameId).emit('gameResigned', resignPayload);
        
        // Direct to white player
        if (game.whitePlayer?.socketId) {
          const isWinner = !isWhiteResigning;
          this.server.to(game.whitePlayer.socketId).emit('gameResigned', {
            ...resignPayload,
            result: isWinner ? 'win' : 'loss',
            resigning: isWhiteResigning
          });
        }
        
        // Direct to black player
        if (game.blackPlayer?.socketId) {
          const isWinner = isWhiteResigning;
          this.server.to(game.blackPlayer.socketId).emit('gameResigned', {
            ...resignPayload,
            result: isWinner ? 'win' : 'loss',
            resigning: !isWhiteResigning
          });
        }
        
        // Return error to client (but we've already handled the event)
        return {
          event: 'gameResigned',
          data: { 
            success: false, 
            message: 'Failed to register resignation but event was processed'
          }
        };
      }
      
      // Regular flow continues if gameResult exists
      
      // Log all relevant IDs for debugging
      this.logger.log(`Resignation - Game details:
        Game ID: ${payload.gameId}
        Resigning client: ${client.id}
        White player socket: ${game.whitePlayer?.socketId || 'unknown'}
        Black player socket: ${game.blackPlayer?.socketId || 'unknown'}
        Winner ID from gameResult: ${gameResult.winnerUserId || 'unknown'}
        Loser ID from gameResult: ${gameResult.loserUserId || 'unknown'}
        Explicitly determined Winner ID: ${winnerSocketId}
        Explicitly determined Loser ID: ${loserSocketId}
      `);
      
      // Create consistent payload for all emissions
      // Use explicitly determined IDs to prevent any inconsistency
      const resignPayload = {
        gameId: payload.gameId,
        reason: 'Player resigned',
        winner: winnerSocketId,
        loser: loserSocketId,
        winnerId: winnerSocketId, // Add redundant fields for compatibility
        loserId: loserSocketId,
        winnerSocketId, // Explicit naming for frontend
        loserSocketId,
        isWhiteResigning,
        timestamp: Date.now()
      };
      
      // Enhanced broadcasting using multiple approaches to ensure both players receive events
      
      // 1. Emit to the game room (standard approach)
      this.logger.log(`Broadcasting gameResigned to room ${payload.gameId}`);
      this.server.to(payload.gameId).emit('gameResigned', resignPayload);
      
      // 2. Also emit game_ended event with consistent format for standardization
      this.logger.log(`Broadcasting game_ended to room ${payload.gameId}`);
      this.server.to(payload.gameId).emit('game_ended', {
        ...resignPayload,
        reason: 'resignation',
      });
      
      // 3. Emit directly to both players as a fallback with player-specific result
      if (game.whitePlayer && game.whitePlayer.socketId) {
        const isWinner = !isWhiteResigning;
        this.logger.log(`Emitting directly to white player: ${game.whitePlayer.socketId}`);
        
        this.server.to(game.whitePlayer.socketId).emit('gameResigned', {
          ...resignPayload,
          result: isWinner ? 'win' : 'loss',
          resigning: isWhiteResigning
        });
        
        this.server.to(game.whitePlayer.socketId).emit('game_ended', {
          ...resignPayload,
          reason: 'resignation',
          isWhitePlayer: true,
          result: isWinner ? 'win' : 'loss'
        });
      }
      
      if (game.blackPlayer && game.blackPlayer.socketId) {
        const isWinner = isWhiteResigning;
        this.logger.log(`Emitting directly to black player: ${game.blackPlayer.socketId}`);
        
        this.server.to(game.blackPlayer.socketId).emit('gameResigned', {
          ...resignPayload,
          result: isWinner ? 'win' : 'loss',
          resigning: !isWhiteResigning
        });
        
        this.server.to(game.blackPlayer.socketId).emit('game_ended', {
          ...resignPayload,
          reason: 'resignation',
          isWhitePlayer: false,
          result: isWinner ? 'win' : 'loss'
        });
      }
      
      // 4. Use the 'emit' method on client to send a response directly back to the resigning player
      client.emit('gameResigned', {
        ...resignPayload,
        resigning: true, // Flag to indicate this is the resigning player
        result: 'loss'   // Explicitly mark as loss for the resigning player
      });
      
      return {
        event: 'gameResigned',
        data: {
          success: true,
          message: 'Game resigned',
          result: gameResult,
        },
      };
    } catch (error) {
      // Catch any unexpected errors to prevent server crashes
      this.logger.error(`Error in handleResign for game ${payload?.gameId}:`, error);
      return {
        event: 'gameResigned',
        data: {
          success: false,
          message: 'Internal server error processing resignation',
        },
      };
    }
  }

  /**
   * Handle a player rejoining a game after reconnection
   */
  @SubscribeMessage('rejoin_game')
  handleRejoinGame(client: Socket, payload: { gameId: string, playerId: string }) {
    this.logger.log(
      `Client ${client.id} requested to rejoin game ${payload.gameId} as player ${payload.playerId}`,
    );
    
    try {
      // Handle player reconnection
      this.disconnectionService.handlePlayerReconnect(this.server, payload.playerId, client.id);
      
      // Add the client to the game room
      client.join(payload.gameId);
      
      return {
        event: 'rejoinGameResponse',
        data: {
          success: true,
          message: 'Successfully rejoined the game',
        },
      };
    } catch (error) {
      this.logger.error(`Error rejoining game for client ${client.id}:`, error);
      
      return {
        event: 'rejoinGameResponse',
        data: {
          success: false,
          message: 'Failed to rejoin game',
          error: error.message,
        },
      };
    }
  }

  /**
   * Handle a client request to abort a game
   */
  @SubscribeMessage('abort_game')
  async handleAbortGame(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} requested to abort game ${payload.gameId}`,
    );
    
    // First, check with the game manager if the game can be aborted
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      this.logger.warn(`Abort request failed: Game ${payload.gameId} not found`);
      
      // Even if the game is not found in the manager, we should still emit the abort event
      // to ensure clients can properly handle the end of game state
      
      const abortPayload = {
        gameId: payload.gameId,
        playerId: client.id,
        playerColor: 'unknown',
        playerName: 'Player',
        opponentName: 'Opponent',
        reason: 'Game aborted by player',
        timestamp: new Date().toISOString(),
        error: 'GAME_NOT_FOUND' // Add error for tracking
      };
      
      // Emit to the game room
      this.server.to(payload.gameId).emit('game_aborted', abortPayload);
      
      // Also emit directly to the requesting client
      client.emit('game_aborted', abortPayload);
      
      return {
        event: 'abortGameResponse',
        data: {
          success: true, // Return success so client proceeds with cleanup
          message: 'Game abort request processed',
          error: 'GAME_NOT_FOUND'
        },
      };
    }
    
    // Stricter validation: Check if any moves have been made
    // This checks the PGN to see if any moves are recorded
    if (game.pgn && game.pgn.trim().length > 0) {
      this.logger.warn(`Abort request failed: Game ${payload.gameId} cannot be aborted - moves have been made. PGN: ${game.pgn}`);
      return {
        event: 'abortGameResponse',
        data: {
          success: false,
          message: 'Cannot abort game after any moves have been made',
          error: 'MOVES_ALREADY_MADE'
        },
      };
    }
    
    // Check if the game can be aborted (first move not made yet)
    if (!game.isFirstMove) {
      this.logger.warn(`Abort request failed: Game ${payload.gameId} cannot be aborted after first move`);
      return {
        event: 'abortGameResponse',
        data: {
          success: false,
          message: 'Cannot abort game after first move',
          error: 'FIRST_MOVE_MADE'
        },
      };
    }
    
    try {
      // Create game end details object for abort
      const gameEndDetails = {
        result: GameResult.ABORTED,
        reason: GameEndReason.ABORT,
        winnerSocketId: undefined,
        loserSocketId: undefined
      };
      
      // Call handleGameEnd to update database
      this.logger.log(`[GameAbortRequest] Calling gameEndService.checkGameEnd for game ${payload.gameId} to update database`);
      const resultData = await this.gameManagerService.checkGameEnd(
        payload.gameId,
        this.server
      );
      
      this.logger.log(`[GameAbortRequest] Game end result: ${resultData ? 'Success' : 'Failed'}`);
      
      // 1. Emit game_aborted event (compatibility)
      this.server.to(payload.gameId).emit('game_aborted', { 
        gameId: payload.gameId,
        reason: GameEndReason.ABORT,
        result: GameResult.ABORTED
      });
      
      // 2. Emit the standard game_end event that the frontend listens for
      const gameEndEvent = {
        gameId: payload.gameId,
        reason: 'abort',
        result: 'aborted',
        finalFEN: game.chessInstance.fen(),
        timestamp: new Date().toISOString(),
        // Include player information
        whitePlayer: {
          socketId: game.whitePlayer.socketId,
          username: game.whitePlayer.username,
          rating: game.whitePlayer.rating || 1500,
          isGuest: game.whitePlayer.isGuest
        },
        blackPlayer: {
          socketId: game.blackPlayer.socketId,
          username: game.blackPlayer.username,
          rating: game.blackPlayer.rating || 1500,
          isGuest: game.blackPlayer.isGuest
        }
      };
      
      // Emit to room
      this.server.to(payload.gameId).emit('game_end', gameEndEvent);
      
      // 4. For backward compatibility, also emit specific events the frontend might be listening for
      this.server.to(payload.gameId).emit('game_ended', {
        gameId: payload.gameId,
        reason: 'abort',
        result: 'aborted',
        timestamp: new Date().toISOString()
      });
      
      this.logger.log(`[GameAbortRequest] Game ${payload.gameId} successfully aborted. Game end events emitted.`);
      
      return {
        event: 'abortGameResponse',
        data: {
          success: true,
          message: 'Game successfully aborted',
        },
      };
    } catch (error) {
      this.logger.error(`Error aborting game for client ${client.id}:`, error);
      
      return {
        event: 'abortGameResponse',
        data: {
          success: false,
          message: 'Failed to abort game',
          error: error.message,
        },
      };
    }
  }

  /**
   * Mark that white has made the first move, preventing further abort requests
   */
  @SubscribeMessage('move_made')
  async handleMoveMade(client: Socket, payload: MoveMadePayload) {
    try {
      // Guard against missing payload properties
      if (!payload || !payload.gameId || !payload.player) {
        this.logger.error('Invalid move_made payload:', payload);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Invalid move payload - missing required fields',
          },
        };
      }
      
      // Check if we have a SAN move or from/to coordinates
      if (!payload.san && (!payload.from || !payload.to)) {
        this.logger.error('Move payload must contain either SAN notation or from/to coordinates:', payload);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Move payload must contain either SAN notation or from/to coordinates',
          },
        };
      }
      
      // Log the move details
      if (payload.san) {
        this.logger.log(`Move made in game ${payload.gameId} by ${payload.player}: ${payload.san}${payload.promotion ? ' promotion: ' + payload.promotion : ''}`);
      } else {
        this.logger.log(`Move made in game ${payload.gameId} by ${payload.player}: ${payload.from} -> ${payload.to}${payload.promotion ? ' promotion: ' + payload.promotion : ''}`);
      }
      
      // Get game from gameManagerService
      const game = this.gameManagerService.getGame(payload.gameId);
      
      // Handle case when game is not found
      if (!game) {
        this.logger.warn(`Game ${payload.gameId} not found for move_made event`);
        
        // Log all available game IDs for debugging
        const availableGames = this.gameManagerService.getAllActiveGames();
        this.logger.warn(`Available games: ${availableGames.map(g => g.gameId).join(', ')}`);
        
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Game not found',
          },
        };
      }
      
      // Verify that game has a valid chessInstance
      if (!game.chessInstance) {
        this.logger.error(`Game ${payload.gameId} has no chess instance`);
        
        // Create a new chess instance for the game
        game.chessInstance = new Chess();
        this.logger.log(`Created new chess instance for game ${payload.gameId}`);
      }
      
      // Check if player is part of the game
      const isWhitePlayer = game.whitePlayer.socketId === client.id;
      const isBlackPlayer = game.blackPlayer.socketId === client.id;
      
      if (!isWhitePlayer && !isBlackPlayer) {
        this.logger.warn(
          `Client ${client.id} is not part of game ${payload.gameId}`,
        );
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'You are not part of this game',
          },
        };
      }
      
      // Mark that this is no longer the first move
      if (payload.player === 'white' && game.isFirstMove) {
        game.isFirstMove = false;
        this.logger.log(`First move made by white in game ${payload.gameId}`);
      }
      
      // Update PGN and last move time
      game.lastMoveTime = new Date();
      
      // Log FEN information from client if available
      if (payload.currentFen) {
        this.logger.log(`Client provided current FEN: ${payload.currentFen}`);
      }
      if (payload.resultingFen) {
        this.logger.log(`Client provided resulting FEN: ${payload.resultingFen}`);
      }
      if (payload.moveHistory) {
        this.logger.log(`Client provided move history with ${payload.moveHistory.length} moves`);
      }
      
      // Check if we should validate the client's current FEN against our server state
      if (payload.currentFen) {
        const serverFen = game.chessInstance.fen();
        
        // Compare only the position part (first 4 parts) of the FEN
        const clientFenParts = payload.currentFen.split(' ');
        const serverFenParts = serverFen.split(' ');
        
        const clientPosition = clientFenParts.slice(0, 4).join(' ');
        const serverPosition = serverFenParts.slice(0, 4).join(' ');
        
        if (clientPosition !== serverPosition) {
          this.logger.warn(`FEN position mismatch. Client: ${clientPosition}, Server: ${serverPosition}`);
          this.logger.warn('Proceeding with move, but board states may be out of sync');
        }
      }
      
      // Get or create a chess instance for this game
      let chessInstance = this.chessInstances.get(payload.gameId);
      
      // If we don't have a chess instance for this game, create one and initialize it
      if (!chessInstance) {
        this.logger.log(`Creating new chess instance for game ${payload.gameId}`);
        chessInstance = new Chess(); // Start with a fresh instance with correct move counts
        this.chessInstances.set(payload.gameId, chessInstance);
      }
      
      // If we have move history from the client, validate and potentially rebuild the board
      if (payload.moveHistory && payload.moveHistory.length > 0) {
        // Compare the client's move history with our server's move history
        const serverMoveHistory = chessInstance.history();
        
        // If the move counts don't match or we need to rebuild, reset and replay the moves
        if (serverMoveHistory.length !== payload.moveHistory.length) {
          this.logger.log(`Move history mismatch. Server: ${serverMoveHistory.length} moves, Client: ${payload.moveHistory.length} moves. Rebuilding board state.`);
          
          // Reset the chess instance to the starting position
          chessInstance.reset();
          
          // Apply each move from the client's move history
          let allMovesApplied = true;
          for (let i = 0; i < payload.moveHistory.length; i++) {
            try {
              const result = chessInstance.move(payload.moveHistory[i]);
              if (!result) {
                this.logger.error(`Failed to apply move ${i+1} during rebuild: ${payload.moveHistory[i]}`);
                allMovesApplied = false;
                break;
              }
            } catch (moveError) {
              this.logger.error(`Error applying move ${i+1} during rebuild: ${payload.moveHistory[i]}. Error: ${moveError.message}`);
              allMovesApplied = false;
              break;
            }
          }
          
          if (!allMovesApplied) {
            // If we couldn't apply all moves, reset and use the game's chess instance as fallback
            this.logger.warn(`Failed to rebuild board from move history. Using game's chess instance as fallback.`);
            chessInstance = game.chessInstance;
            this.chessInstances.set(payload.gameId, chessInstance);
          } else {
            this.logger.log(`Successfully rebuilt board from move history. New FEN: ${chessInstance.fen()}`);
          }
        }
      }
      
      // Update the game's chess instance with our validated instance
      game.chessInstance = chessInstance;
      
      // Now apply the new move
      try {
        let moveResult;
        
        // Apply the move using SAN notation if provided, otherwise use from/to coordinates
        if (payload.san) {
          this.logger.log(`Applying move using SAN notation: ${payload.san}`);
          moveResult = chessInstance.move(payload.san);
          
          if (!moveResult) {
            this.logger.error(`Invalid SAN move attempted: ${payload.san}`);
            return {
              event: 'moveMadeResponse',
              data: {
                success: false,
                message: `Invalid SAN move: ${payload.san}`,
              },
            };
          }
        } else {
          // Using from/to coordinates (legacy approach)
          const moveOptions: { from: string; to: string; promotion?: string } = {
            from: payload.from!,
            to: payload.to!,
          };
          
          if (payload.promotion) {
            const mappedPromotion = pieceTypeToChessJs[payload.promotion.toLowerCase()];
            if (mappedPromotion) {
              moveOptions.promotion = mappedPromotion;
            } else {
              this.logger.warn(`Invalid or unmapped promotion piece received: ${payload.promotion}. Move will attempt without specific promotion piece if mapping failed.`);
            }
          }
          
          moveResult = chessInstance.move(moveOptions);
          
          if (!moveResult) {
            this.logger.error(`Invalid move attempted: ${payload.from} -> ${payload.to}`);
            return {
              event: 'moveMadeResponse',
              data: {
                success: false,
                message: `Invalid move: ${payload.from} -> ${payload.to}`,
              },
            };
          }
        }
        
        // Get the move in SAN format from the move result
        const sanMove = moveResult.san;
        
        // Get the current move history
        const moveHistory = chessInstance.history();
        
        // Log the successful move and the current move history
        this.logger.log(`Successfully applied move: ${sanMove}`);
        this.logger.log(`Current move history: ${moveHistory.join(', ')}`);
        
        // Update PGN
        game.pgn = chessInstance.pgn();
        
        // Update turn
        game.whiteTurn = !game.whiteTurn;
        
        // Get the current FEN after the move
        const currentFen = chessInstance.fen();
        
        // Log FEN details for debugging
        const fenParts = currentFen.split(' ');
        this.logger.log(`Current FEN after move: ${currentFen}`);
        this.logger.log(`FEN parts: position=${fenParts.slice(0, 4).join(' ')}, halfmove=${fenParts[4]}, fullmove=${fenParts[5]}`);
      } catch (chessError) {
        this.logger.error(`Chess engine error: ${chessError.message}`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Chess engine error',
            error: chessError.message
          },
        };
      }
      
      // Safely check notation for properties
      const isCapture = payload.notation && typeof payload.notation === 'string' && payload.notation.includes('x');
      const isCheck = payload.notation && typeof payload.notation === 'string' && 
        (payload.notation.includes('+') || payload.notation.includes('#'));
      
      // Get the current FEN after the move
      const currentFen = game.chessInstance.fen();
      
      // Log the current FEN for debugging
      this.logger.log(`Current FEN after move: ${currentFen}`);
      
      // Update the game in the database with the current move history, move count, and FEN
      try {
        if (game.dbGameId) {
          // Get the current FEN from the chess instance
          const currentFen = chessInstance.fen();
          
          // Get the move history in SAN format
          const moveHistory = chessInstance.history();
          
          // Get the verbose move history with more details
          const verboseMoveHistory = chessInstance.history({ verbose: true });
          
          // Get the total number of moves
          const totalMoves = moveHistory.length;
          
          // Extract the move counts from the FEN string for logging
          const fenParts = currentFen.split(' ');
          const halfMoveClock = parseInt(fenParts[4]);
          const fullMoveNumber = parseInt(fenParts[5]);
          
          this.logger.log(`Move counts from FEN: halfMoveClock=${halfMoveClock}, fullMoveNumber=${fullMoveNumber}`);
          this.logger.log(`Total moves in history: ${totalMoves}`);
          
          // Update the database with the current game state
          // Using move history as the primary source of truth
          await this.gameRepositoryService.update(game.dbGameId, {
            pgn: game.pgn,
            moves: verboseMoveHistory, // Store the verbose move history
            totalMoves: totalMoves, // Store the total number of moves
            fen: currentFen // Store the current FEN as a secondary reference
          });
          
          this.logger.log(`Updated game ${payload.gameId} in database with ${totalMoves} moves and FEN: ${currentFen}`);
        }
      } catch (dbError) {
        this.logger.error(`Error updating game in database: ${dbError.message}`);
      }
      
      // We've already checked that game exists earlier in the function, but let's add an extra check
      // to satisfy TypeScript and prevent potential runtime errors
      if (!game) {
        this.logger.error(`Game ${payload.gameId} not found after move application. This should not happen.`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Game not found after move application',
          },
        };
      }
      
      // Get the current game state for broadcasting
      const gameFen = chessInstance.fen();
      const gameMoveHistory = chessInstance.history();
      const gameVerboseMoveHistory = chessInstance.history({ verbose: true });
      
      // Get the move that was just made (the last move in the history)
      const lastMove = gameMoveHistory.length > 0 ? gameMoveHistory[gameMoveHistory.length - 1] : null;
      
      // Determine if the move was a capture or check
      const moveIsCapture = lastMove ? lastMove.includes('x') : false;
      const moveIsCheck = lastMove ? lastMove.includes('+') || lastMove.includes('#') : false;
      
      // Log the move details
      this.logger.log(`Last move: ${lastMove}, isCapture: ${moveIsCapture}, isCheck: ${moveIsCheck}`);
      
      // Check for threefold repetition
      const isThreefoldRepetition = chessInstance.isThreefoldRepetition();
      if (isThreefoldRepetition) {
        this.logger.log(`Threefold repetition detected in game ${payload.gameId} after move ${lastMove}`);
      }
      
      // Create a board_updated event with move history as the primary source of truth
      const boardUpdatedEvent = {
        gameId: payload.gameId,
        moveHistory: gameMoveHistory, // Primary source of truth
        verboseMoveHistory: gameVerboseMoveHistory, // Detailed move information
        lastMove: lastMove, // The move that was just made
        fen: gameFen, // Current FEN (for validation)
        pgn: game.pgn, // PGN representation
        whiteTurn: game.whiteTurn, // Whose turn it is
        isCapture: moveIsCapture, // Whether the move was a capture
        isCheck: moveIsCheck, // Whether the move resulted in check
        moveCount: gameMoveHistory.length, // Total number of moves
        isThreefoldRepetition: isThreefoldRepetition, // Whether threefold repetition has occurred
        timestamp: Date.now() // Timestamp for synchronization
      };
      
      // Broadcast the board_updated event to all clients in the game room
      this.server.to(payload.gameId).emit('board_updated', boardUpdatedEvent);
      
      // For backward compatibility, also emit the move_made event
      this.server.to(payload.gameId).emit('move_made', {
        ...payload,
        san: lastMove, // Include the SAN notation of the move
        isCapture: moveIsCapture,
        isCheck: moveIsCheck,
        fen: gameFen,
        moveHistory: gameMoveHistory,
        pgn: game?.pgn || ''
      });
      
      // Return a success response
      return {
        event: 'moveMadeResponse',
        data: {
          success: true,
          message: 'Move applied successfully',
          moveHistory: gameMoveHistory,
          fen: gameFen,
          pgn: game?.pgn || '',
          whiteTurn: game?.whiteTurn || false
        },
      };
      
      // Early return if game is not defined
      if (!game) {
        return {
          event: 'moveMadeResponse',
          data: {
            success: true,
            message: 'Move applied successfully',
            moveHistory: gameMoveHistory,
            fen: gameFen,
            pgn: '',
            whiteTurn: false
          },
        };
      }
      
      // Check for game end conditions like checkmate
      if (game?.chessInstance?.isCheckmate?.()) {
        this.logger.log(`Checkmate detected in game ${payload.gameId}`);
        // Add null checks for all game properties
        const winnerColor = game?.whiteTurn ? 'black' : 'white'; // The one who just moved
        const loserColor = game?.whiteTurn ? 'white' : 'black'; // The one who got checkmated
        
        // Add additional logging for database ID
        this.logger.log(`Checkmate detected - database ID: ${game?.dbGameId || 'not available'}, event gameId: ${payload.gameId}`);
        
        // Log the attempt to call checkGameEnd
        this.logger.log(`Calling checkGameEnd for checkmate in game ${payload.gameId}, database ID: ${game?.dbGameId || 'not available'}`);
        
        try {
          // Call checkGameEnd to update the database record
          const resultData = await this.gameManagerService.checkGameEnd(
            payload.gameId,
            this.server
          );
          
          if (resultData) {
            this.logger.log(`Successfully handled game end for ${payload.gameId}`);
          } else {
            this.logger.warn(`checkGameEnd returned null for ${payload.gameId}, may need manual game end handling`);
            
            // Emit game_end event to clients as fallback
            this.server.to(payload.gameId).emit('game_end', {
              result: 'checkmate',
              reason: 'checkmate',
              winnerColor: winnerColor,
              loserColor: loserColor,
              finalFEN: game?.chessInstance?.fen() || ''
            });
          }
        } catch (error) {
          this.logger.error(`Error handling game end for ${payload.gameId}: ${error.message}`, error.stack);
          
          // Even if checkGameEnd fails, still emit the game_end event to clients
          this.server.to(payload.gameId).emit('game_end', {
            result: 'checkmate',
            reason: 'checkmate',
            winnerColor: winnerColor,
            loserColor: loserColor,
            finalFEN: game?.chessInstance?.fen() || ''
          });
        }
      } else if (game?.chessInstance?.isDraw?.() || 
                game?.chessInstance?.isStalemate?.() || 
                game?.chessInstance?.isThreefoldRepetition?.() || 
                game?.chessInstance?.isInsufficientMaterial?.()) {
        this.logger.log(`Draw detected in game ${payload.gameId}`);
        
        // Log the attempt to call checkGameEnd
        this.logger.log(`Calling checkGameEnd for draw in game ${payload.gameId}, database ID: ${game?.dbGameId || 'not available'}`);
        
        try {
          // Call checkGameEnd to update the database record
          const resultData = await this.gameManagerService.checkGameEnd(
            payload.gameId,
            this.server
          );
          
          if (resultData) {
            this.logger.log(`Successfully handled game end for ${payload.gameId}`);
          } else {
            this.logger.warn(`checkGameEnd returned null for ${payload.gameId}, may need manual game end handling`);
            
            // Emit game_end event to clients as fallback
            this.server.to(payload.gameId).emit('game_end', {
              result: 'draw',
              reason: 'draw',
              finalFEN: game?.chessInstance?.fen() || ''
            });
          }
        } catch (error) {
          this.logger.error(`Error handling game end for ${payload.gameId}: ${error.message}`, error.stack);
          
          // Even if checkGameEnd fails, still emit the game_end event to clients
          this.server.to(payload.gameId).emit('game_end', {
            result: 'draw',
            reason: 'draw',
            finalFEN: game?.chessInstance?.fen() || ''
          });
        }
      }
      
      return {
        event: 'moveMadeResponse',
        data: {
          success: true,
        },
      };
    } catch (error) {
      this.logger.error(`Error in handleMoveMade:`, error);
      return {
        event: 'moveMadeResponse',
        data: {
          success: false,
          message: 'Internal server error processing move',
          error: error.message,
        },
      };
    }
  }

  /**
   * Handle a request for board state synchronization
   */
  @SubscribeMessage('request_board_sync')
  handleBoardSyncRequest(client: Socket, payload: { gameId: string, reason: string, clientState?: string }) {
    try {
      this.logger.log(`Client ${client.id} requested board sync for game ${payload.gameId}. Reason: ${payload.reason}`);
      
      // Get game from gameManagerService
      const game = this.gameManagerService.getGame(payload.gameId);
      
      if (!game) {
        this.logger.warn(`Game ${payload.gameId} not found for board sync request`);
        return {
          event: 'boardSyncResponse',
          data: {
            success: false,
            message: 'Game not found',
          },
        };
      }
      
      // Get the current FEN position from the chess instance
      const fen = game.chessInstance.fen();
      
      // Log the client's current state vs server state if provided
      if (payload.clientState) {
        this.logger.log(`Client state: ${payload.clientState}`);
        this.logger.log(`Server state: ${fen}`);
      }
      
      // Get the move history in SAN format
      const moveHistory = game.chessInstance.history();
      
      // Get the verbose move history with more details
      const verboseMoveHistory = game.chessInstance.history({ verbose: true });
      
      // Send board sync event back to the client with complete game state
      client.emit('board_sync', {
        gameId: payload.gameId,
        fen,
        moveHistory,
        verboseMoveHistory,
        pgn: game.pgn,
        timestamp: Date.now(),
        whiteTurn: game.whiteTurn
      });
      
      this.logger.log(`Sent board sync to client ${client.id} with FEN: ${fen} and ${moveHistory.length} moves`);
      
      return {
        event: 'boardSyncResponse',
        data: {
          success: true,
          message: 'Board sync sent',
        },
      };
    } catch (error) {
      this.logger.error(`Error in handleBoardSyncRequest:`, error);
      return {
        event: 'boardSyncResponse',
        data: {
          success: false,
          message: 'Internal server error processing board sync request',
          error: error.message,
        },
      };
    }
  }

  /**
   * Handle a player joining a game room
   */
  @SubscribeMessage('join_game_room')
  handleJoinGameRoom(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} is joining game room ${payload.gameId}`,
    );
    
    // Verify if the game exists in the game manager
    const gameExists = this.gameManagerService.getGame(payload.gameId);
    if (!gameExists) {
      this.logger.warn(`Client ${client.id} attempted to join non-existent game room ${payload.gameId}`);
      
      // Log the keys of all active games for debugging
      const activeGames = this.gameManagerService.getAllActiveGames();
      this.logger.log(`Active game IDs: [${activeGames.map(g => g.gameId).join(', ')}]`);
    }
    
    // Add the client to the game room
    client.join(payload.gameId);
    
    // Log room join success
    this.logger.log(`Client ${client.id} successfully joined room ${payload.gameId}`);
    
    // Notify the client that they've joined
    client.emit('joined_game_room', {
      gameId: payload.gameId,
      playerId: client.id
    });
    
    return {
      event: 'joinGameRoomResponse',
      data: {
        success: true,
        message: 'Successfully joined the game room',
      },
    };
  }
  
  /**
   * Handle a client reporting a timeout
   */
  @SubscribeMessage('report_timeout')
  async handleReportTimeout(client: Socket, payload: { gameId: string, color: 'w' | 'b' }) {
    this.logger.log(
      `[TIMEOUT] Timeout reported for ${payload.color === 'w' ? 'white' : 'black'} in game ${payload.gameId}`,
    );
    
    // Verify reporter is in the game
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'timeoutReported',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Verify the reporter is a player in the game
    const isPlayerInGame = 
      game.whitePlayer.socketId === client.id || 
      game.blackPlayer.socketId === client.id;
    
    if (!isPlayerInGame) {
      return {
        event: 'timeoutReported',
        data: {
          success: false,
          message: 'Only players can report timeouts',
        },
      };
    }
    
    // Add explicit logging to track timeout processing
    this.logger.log(`[TIMEOUT] Processing timeout in game ${payload.gameId} with database ID: ${game.dbGameId || 'not available'}`);
    
    // Register the timeout
    const gameResult = await this.gameManagerService.registerTimeout(
      payload.gameId,
      payload.color,
      this.server,
    );
    
    if (gameResult) {
      // Add explicit logging to confirm the timeout was processed with the correct reason
      this.logger.log(`[TIMEOUT] Timeout successfully processed for game ${payload.gameId} with reason: ${gameResult.reason}`);
      
      // Make sure we emit the game_end event with the correct reason
      this.server.to(payload.gameId).emit('game_end', {
        gameId: payload.gameId,
        reason: 'timeout',
        result: gameResult.result,
        winnerColor: payload.color === 'w' ? 'black' : 'white',
        loserColor: payload.color === 'w' ? 'white' : 'black',
        finalFEN: game.chessInstance.fen(),
        timestamp: new Date().toISOString()
      });
      
      // For backward compatibility, also emit the game_ended event
      this.server.to(payload.gameId).emit('game_ended', {
        gameId: payload.gameId,
        reason: 'timeout',
        result: gameResult.result,
        timestamp: new Date().toISOString()
      });
      
      return {
        event: 'timeoutReported',
        data: {
          success: true,
          message: `${payload.color === 'w' ? 'White' : 'Black'} player timeout registered`,
          result: gameResult,
        },
      };
    }
    
    return {
      event: 'timeoutReported',
      data: {
        success: false,
        message: 'Failed to register timeout',
      },
    };
  }
  
  /**
   * Handle a player claiming a draw (e.g., for insufficent material)
   */
  @SubscribeMessage('claim_draw')
  async handleClaimDraw(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} claimed a draw in game ${payload.gameId}`
    );
    
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'drawClaimed',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Check if the game has actually ended in a draw
    const gameResult = await this.gameManagerService.checkGameEnd(
      payload.gameId,
      this.server
    );
    
    if (gameResult && gameResult.result === 'draw') {
      return {
        event: 'drawClaimed',
        data: {
          success: true,
          message: 'Draw claim valid',
          result: gameResult,
        },
      };
    }
    
    return {
      event: 'drawClaimed',
      data: {
        success: false,
        message: 'Invalid draw claim',
      },
    };
  }

  /**
   * Handle a client offering a draw
   */
  @SubscribeMessage('draw_request')
  handleDrawRequest(client: Socket, payload: { gameId: string }) {
    this.logger.log(`Client ${client.id} offered a draw in game ${payload.gameId}`);
    const game = this.gameManagerService.getGame(payload.gameId);
    if (!game) {
      return { event: 'draw_request', data: { success: false, message: 'Game not found' } };
    }
    // Store who offered the draw
    (game as any).drawOfferBy = client.id;
    // Find opponent
    const opponentId = (game.whitePlayer.socketId === client.id)
      ? game.blackPlayer.socketId
      : game.whitePlayer.socketId;
    // Emit to opponent
    this.server.to(opponentId).emit('draw_request', { gameId: payload.gameId, playerId: client.id });
    return { event: 'draw_request', data: { success: true } };
  }

  /**
   * Handle a client responding to a draw offer
   */
  @SubscribeMessage('draw_response')
  handleDrawResponse(client: Socket, payload: { gameId: string; accepted: boolean }) {
    this.logger.log(`Client ${client.id} responded to draw in game ${payload.gameId}: ${payload.accepted}`);
    const game = this.gameManagerService.getGame(payload.gameId);
    if (!game) {
      return { event: 'draw_response', data: { success: false, message: 'Game not found' } };
    }
    const offererId = (game as any).drawOfferBy;
    if (!offererId) {
      return { event: 'draw_response', data: { success: false, message: 'No draw offer to respond to' } };
    }
    if (payload.accepted) {
      // End the game as a draw
      this.server.to(payload.gameId).emit('game_drawn', { gameId: payload.gameId });
      // Update game state and ratings for draw
      if (game && !game.ended) {
        this.gameManagerService['handleGameEnd'](
          payload.gameId,
          { result: GameResult.DRAW, reason: GameEndReason.DRAW_AGREEMENT },
          this.server
        );
      }
    } else {
      // Notify the offerer that the draw was declined
      this.server.to(offererId).emit('draw_response', { gameId: payload.gameId, accepted: false });
    }
    // Clear draw offer
    (game as any).drawOfferBy = undefined;
    return { event: 'draw_response', data: { success: true } };
  }

  /**
   * Handle game end event from client
   * This handles various game-ending scenarios including threefold repetition
   */
  @SubscribeMessage('game_end')
  async handleGameEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string, reason: string, fen?: string, moveHistory?: string[] },
  ) {
    try {
      this.logger.log(`[GAME_END] Client ${client.id} reported game end in game ${payload.gameId} with reason: ${payload.reason}`);
      
      // Get the game from the game manager
      const game = this.gameManagerService.getGame(payload.gameId);
      if (!game) {
        this.logger.error(`[GAME_END] Game ${payload.gameId} not found for game_end event`);
        return {
          event: 'error',
          data: { success: false, message: 'Game not found' }
        };
      }
      
      // Update user activity status to no longer in game for both players
      if (game.whitePlayer?.socketId) {
        const whiteSocket = this.safeGetSocket(game.whitePlayer.socketId);
        if (whiteSocket?.handshake?.auth?.uid) {
          this.userActivityService.registerLeftGame(whiteSocket.handshake.auth.uid);
        }
      }
      
      if (game.blackPlayer?.socketId) {
        const blackSocket = this.safeGetSocket(game.blackPlayer.socketId);
        if (blackSocket?.handshake?.auth?.uid) {
          this.userActivityService.registerLeftGame(blackSocket.handshake.auth.uid);
        }
      }
      
      // Check if the game is already over
      if (game.ended) {
        this.logger.warn(`[GAME_END] Game ${payload.gameId} is already over, ignoring game_end event`);
        return {
          event: 'error',
          data: { success: false, message: 'Game is already over' }
        };
      }
      
      // Handle threefold repetition with enhanced validation
      if (payload.reason === 'threefold_repetition') {
        this.logger.log(`[GAME_END] Processing threefold repetition for game ${payload.gameId}`);
        
        // Log received FEN and move history for debugging
        if (payload.fen) {
          this.logger.log(`[GAME_END] Client reported FEN: ${payload.fen}`);
        }
        if (payload.moveHistory) {
          this.logger.log(`[GAME_END] Client reported move history: ${JSON.stringify(payload.moveHistory)}`);
        }
        
        // Get or use the dedicated chess instance for this game
        let chessInstance = this.chessInstances.get(payload.gameId);
        if (!chessInstance) {
          // If we don't have a dedicated instance, use the game's instance
          chessInstance = game.chessInstance;
          // And store it for future use
          this.chessInstances.set(payload.gameId, chessInstance);
        }
        
        // If we have move history from the client, validate and potentially rebuild the board
        if (payload.moveHistory && payload.moveHistory.length > 0) {
          // Compare the client's move history with our server's move history
          const serverMoveHistory = chessInstance.history();
          
          // If the move counts don't match or we need to rebuild, reset and replay the moves
          if (serverMoveHistory.length !== payload.moveHistory.length) {
            this.logger.log(`[GAME_END] Move history mismatch. Server: ${serverMoveHistory.length} moves, Client: ${payload.moveHistory.length} moves. Rebuilding board state.`);
            
            // Reset the chess instance to the starting position
            chessInstance.reset();
            
            // Apply each move from the client's move history
            let allMovesApplied = true;
            for (let i = 0; i < payload.moveHistory.length; i++) {
              try {
                const result = chessInstance.move(payload.moveHistory[i]);
                if (!result) {
                  this.logger.error(`[GAME_END] Failed to apply move ${i+1} during rebuild: ${payload.moveHistory[i]}`);
                  allMovesApplied = false;
                  break;
                }
              } catch (moveError) {
                this.logger.error(`[GAME_END] Error applying move ${i+1} during rebuild: ${payload.moveHistory[i]}. Error: ${moveError.message}`);
                allMovesApplied = false;
                break;
              }
            }
            
            if (!allMovesApplied) {
              // If we couldn't apply all moves, reset and use the game's chess instance as fallback
              this.logger.warn(`[GAME_END] Failed to rebuild board from move history. Using game's chess instance as fallback.`);
              chessInstance = game.chessInstance;
              this.chessInstances.set(payload.gameId, chessInstance);
            } else {
              this.logger.log(`[GAME_END] Successfully rebuilt board from move history. New FEN: ${chessInstance.fen()}`);
              // Update the game's chess instance with our rebuilt instance
              game.chessInstance = chessInstance;
            }
          }
        }
        
        // Validate the current position using the server's chess instance
        const serverFen = chessInstance.fen();
        this.logger.log(`[GAME_END] Server current FEN: ${serverFen}`);
        
        // Double-check threefold repetition using the server's chess instance
        const isThreefoldRepetition = chessInstance.isThreefoldRepetition();
        this.logger.log(`[GAME_END] Server threefold repetition check: ${isThreefoldRepetition}`);
        
        // If server doesn't detect threefold repetition, force check using the game end service
        if (!isThreefoldRepetition) {
          this.logger.log(`[GAME_END] Server didn't detect threefold repetition, using forceThreefoldCheck=true`);
        }
        
        // Get game end details using the game end service with forceThreefoldCheck=true
        const gameEndDetails = this.gameEndService.checkGameEnd(
          chessInstance,
          game.whitePlayer.socketId,
          game.blackPlayer.socketId,
          undefined, // No timeout
          undefined, // No resignation
          false, // No draw agreement
          undefined, // No disconnection
          false, // Not first move
          true // Force threefold repetition check
        );
        
        // If threefold repetition is confirmed or we're forcing it (client detected it)
        if (gameEndDetails && (gameEndDetails.reason === GameEndReason.THREEFOLD_REPETITION || isThreefoldRepetition)) {
          // Handle the game end
          this.logger.log(`[GAME_END] Threefold repetition confirmed for game ${payload.gameId}`);
          
          // Mark the game as ended in the game manager
          game.ended = true;
          
          // Get the database ID for the game
          const dbGameId = game.dbGameId || payload.gameId;
          
          // Update the game in the database
          try {
            // Mark the game as draw with threefold_repetition reason
            await this.gameRepositoryService.update(dbGameId, {
              status: 'draw', // Using a valid status value from the Game entity
              endReason: 'threefold_repetition', // Using the correct property name from the Game entity
              pgn: chessInstance.pgn(), // Include the final PGN
              moves: chessInstance.history({ verbose: true }), // Include detailed move history
              totalMoves: chessInstance.history().length // Include total moves count
            });
            
            this.logger.log(`[GAME_END] Game ${payload.gameId} updated in database as draw with threefold_repetition reason`);
          } catch (dbError) {
            this.logger.error(`[GAME_END] Error updating game in database: ${dbError.message}`);
          }
          
          // Calculate rating changes if the game is rated
          let whiteRatingChange = 0;
          let blackRatingChange = 0;
          
          if (game.rated) {
            try {
              // For a draw, both players' ratings change based on their rating difference
              const ratingChanges = this.ratingService.calculateGameRatingChanges(
                game.whitePlayer.rating || 1500,
                game.blackPlayer.rating || 1500,
                RatingResult.DRAW
              );
              
              whiteRatingChange = ratingChanges.white.ratingChange;
              blackRatingChange = ratingChanges.black.ratingChange;
              
              // Update player ratings in the database
              const dbGameId = game.dbGameId || payload.gameId;
              await this.gameRepositoryService.update(dbGameId, {
                whitePlayerRatingAfter: (game.whitePlayer.rating || 1500) + whiteRatingChange,
                blackPlayerRatingAfter: (game.blackPlayer.rating || 1500) + blackRatingChange,
              });
              
              this.logger.log(`[GAME_END] Updated ratings for game ${payload.gameId}: White: ${whiteRatingChange}, Black: ${blackRatingChange}`);
            } catch (ratingError) {
              this.logger.error(`[GAME_END] Error calculating or updating ratings: ${ratingError.message}`);
            }
          } else {
            this.logger.log(`[GAME_END] Game ${payload.gameId} is unrated, no rating changes`);
          }
          
          // Create a consistent payload for all emissions
          const gameEndPayload = {
            gameId: payload.gameId,
            reason: 'threefold_repetition',
            result: 'draw',
            timestamp: Date.now(),
            whitePlayer: {
              username: game.whitePlayer.username,
              rating: game.whitePlayer.rating || 1500,
              ratingChange: whiteRatingChange,
              // Use optional chaining to safely access photoURL if it exists
              photoURL: game.whitePlayer.photoURL || null
            },
            blackPlayer: {
              username: game.blackPlayer.username,
              rating: game.blackPlayer.rating || 1500,
              ratingChange: blackRatingChange,
              // Use optional chaining to safely access photoURL if it exists
              photoURL: game.blackPlayer.photoURL || null
            },
            finalFEN: chessInstance.fen()
          };
          
          // Log the payload we're about to emit
          this.logger.log(`[GAME_END] Emitting game_end event to room ${payload.gameId} with payload:`, JSON.stringify(gameEndPayload));
          
          // Emit to all clients in the game room
          this.server.to(payload.gameId).emit('game_end', gameEndPayload);
          this.server.to(payload.gameId).emit('game_ended', gameEndPayload); // For backward compatibility
          
          // Also emit directly to each player to ensure delivery
          if (game.whitePlayer?.socketId) {
            this.logger.log(`[GAME_END] Emitting game_end event directly to white player: ${game.whitePlayer.socketId}`);
            this.server.to(game.whitePlayer.socketId).emit('game_end', gameEndPayload);
            this.server.to(game.whitePlayer.socketId).emit('game_ended', gameEndPayload);
          }
          
          if (game.blackPlayer?.socketId) {
            this.logger.log(`[GAME_END] Emitting game_end event directly to black player: ${game.blackPlayer.socketId}`);
            this.server.to(game.blackPlayer.socketId).emit('game_end', gameEndPayload);
            this.server.to(game.blackPlayer.socketId).emit('game_ended', gameEndPayload);
          }
          
          // Also emit a board_updated event with isGameOver flag to ensure both clients update their UI
          // This is crucial for threefold repetition to ensure both players navigate to the result screen
          const boardUpdatePayload = {
            gameId: payload.gameId,
            moveHistory: chessInstance.history(),
            verboseMoveHistory: chessInstance.history({ verbose: true }),
            fen: chessInstance.fen(),
            pgn: chessInstance.pgn(),
            whiteTurn: game.whiteTurn,
            isGameOver: true,
            gameOverReason: 'threefold_repetition',
            timestamp: Date.now()
          };
          
          this.logger.log(`[GAME_END] Emitting board_updated event with isGameOver flag to room ${payload.gameId}`);
          this.server.to(payload.gameId).emit('board_updated', boardUpdatePayload);
          
          // Also emit directly to each player to ensure delivery
          if (game.whitePlayer?.socketId) {
            this.server.to(game.whitePlayer.socketId).emit('board_updated', boardUpdatePayload);
          }
          
          if (game.blackPlayer?.socketId) {
            this.server.to(game.blackPlayer.socketId).emit('board_updated', boardUpdatePayload);
          }
          
          // Send delayed events as a fallback in case the first ones didn't arrive
          setTimeout(() => {
            this.logger.log(`[GAME_END] Sending delayed game_end events as fallback for game ${payload.gameId}`);
            this.server.to(payload.gameId).emit('game_end', gameEndPayload);
            this.server.to(payload.gameId).emit('game_ended', gameEndPayload);
            
            if (game.whitePlayer?.socketId) {
              this.server.to(game.whitePlayer.socketId).emit('game_end', gameEndPayload);
              this.server.to(game.whitePlayer.socketId).emit('game_ended', gameEndPayload);
            }
            
            if (game.blackPlayer?.socketId) {
              this.server.to(game.blackPlayer.socketId).emit('game_end', gameEndPayload);
              this.server.to(game.blackPlayer.socketId).emit('game_ended', gameEndPayload);
            }
            
            // Also resend the board_updated event in the delayed fallback
            this.logger.log(`[GAME_END] Sending delayed board_updated event as fallback for game ${payload.gameId}`);
            this.server.to(payload.gameId).emit('board_updated', boardUpdatePayload);
            
            if (game.whitePlayer?.socketId) {
              this.server.to(game.whitePlayer.socketId).emit('board_updated', boardUpdatePayload);
            }
            
            if (game.blackPlayer?.socketId) {
              this.server.to(game.blackPlayer.socketId).emit('board_updated', boardUpdatePayload);
            }
          }, 1000); // Send again after 1 second
          
          // Return success response
          return {
            event: 'game_end',
            data: {
              success: true,
              message: 'Game ended due to threefold repetition',
              result: 'draw',
              reason: 'threefold_repetition'
            }
          };
        } else {
          this.logger.warn(`[GAME_END] Threefold repetition not confirmed by game end service for game ${payload.gameId}`);
          return {
            event: 'error',
            data: { success: false, message: 'Threefold repetition not confirmed' }
          };
        }
      }
      
      // Handle other game end reasons here if needed
      // ...
      
      // If we reach here, the reason wasn't handled
      this.logger.warn(`[GAME_END] Unhandled game end reason: ${payload.reason}`);
      return {
        event: 'error',
        data: { success: false, message: `Unhandled game end reason: ${payload.reason}` }
      };
    } catch (error) {
      this.logger.error(`[GAME_END] Error handling game end: ${error.message}`);
      return {
        event: 'error',
        data: { success: false, message: `Error: ${error.message}` }
      };
    }
  }

  // Handle game abort requests
  @SubscribeMessage('game_abort_request')
  async handleGameAbortRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string },
  ): Promise<void> {
    const { gameId } = payload;
    const game = this.gameManagerService.getGame(gameId);

    if (!game) {
      this.logger.warn(`[GameAbortRequest] Game ${gameId} not found: ${gameId}`);
      // Optionally emit an error back to the client if game not found
      client.emit('error_occurred', { message: 'Game not found for abort request.', gameId });
      return;
    }

    this.logger.log(`[GameAbortRequest] Client ${client.id} requested to abort game ${gameId}`);

    // Validate that the requesting client is part of the game
    if (client.id !== game.whitePlayer.socketId && client.id !== game.blackPlayer.socketId) {
      this.logger.warn(`[GameAbortRequest] Client ${client.id} is not a player in game ${gameId}. Abort request denied.`);
      client.emit('game_abort_rejected', { gameId, message: 'You are not a player in this game.' });
      return;
    }

    // Check if any moves have been made.
    // Using `game.chessInstance.history().length` is a reliable way from chess.js perspective.
    const movesMade = game.chessInstance.history().length > 0;

    if (movesMade) {
      this.logger.log(`[GameAbortRequest] Game ${gameId} has moves. Abort request rejected.`);
      // Optionally inform the requesting client
      client.emit('game_abort_rejected', { gameId, message: 'Cannot abort game, moves have already been made.' });
    } else {
      this.logger.log(`[GameAbortRequest] Game ${gameId} has no moves. Processing abort.`);
      
      try {
        // Create game end details object for abort
        const gameEndDetails = {
          result: GameResult.ABORTED,
          reason: GameEndReason.ABORT,
          winnerSocketId: undefined,
          loserSocketId: undefined
        };
        
        // Call handleGameEnd to update database
        this.logger.log(`[GameAbortRequest] Calling gameEndService.checkGameEnd for game ${gameId} to update database`);
        const resultData = await this.gameManagerService.checkGameEnd(
          gameId,
          this.server
        );
        
        this.logger.log(`[GameAbortRequest] Game end result: ${resultData ? 'Success' : 'Failed'}`);
        
        // 1. Emit game_aborted event (compatibility)
        this.server.to(payload.gameId).emit('game_aborted', { 
          gameId: payload.gameId,
          reason: GameEndReason.ABORT,
          result: GameResult.ABORTED
        });
        
        // 2. Emit the standard game_end event that the frontend listens for
        const gameEndEvent = {
          gameId: payload.gameId,
          reason: 'abort',
          result: 'aborted',
          finalFEN: game.chessInstance.fen(),
          timestamp: new Date().toISOString(),
          // Include player information
          whitePlayer: {
            socketId: game.whitePlayer.socketId,
            username: game.whitePlayer.username,
            rating: game.whitePlayer.rating || 1500,
            isGuest: game.whitePlayer.isGuest
          },
          blackPlayer: {
            socketId: game.blackPlayer.socketId,
            username: game.blackPlayer.username,
            rating: game.blackPlayer.rating || 1500,
            isGuest: game.blackPlayer.isGuest
          }
        };
        
        // Emit to room
        this.server.to(payload.gameId).emit('game_end', gameEndEvent);
        
        // 4. For backward compatibility, also emit specific events the frontend might be listening for
        this.server.to(payload.gameId).emit('game_ended', {
          gameId: payload.gameId,
          reason: 'abort',
          result: 'aborted',
          timestamp: new Date().toISOString()
        });
        
        this.logger.log(`[GameAbortRequest] Game ${payload.gameId} successfully aborted. Game end events emitted.`);
      } catch (error) {
        this.logger.error(`[GameAbortRequest] Error processing game abort: ${error.message}`, error.stack);
        client.emit('error_occurred', { message: 'Error processing game abort on server.', gameId });
      }
    }
  }
} 