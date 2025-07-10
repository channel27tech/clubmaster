import { SubscribeMessage, MessageBody, ConnectedSocket, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { GameEndService, GameEndReason, GameResult } from './game-end/game-end.service';
import { Chess, Color } from 'chess.js';
import { MatchmakingService } from './matchmaking.service';
import { GameManagerService } from './game-manager.service';
import { RatingService } from './rating/rating.service';
import { DisconnectionService } from './disconnection.service';
import { UsersService } from '../users/users.service';
import { GameRepositoryService } from './game-repository.service';
import { UserActivityService } from '../users/user-activity.service';

// Define an interface for the move_made payload
interface MoveMadePayload {
  gameId: string;
  from?: string; 
  to?: string; 
  player: string;
  notation?: string; 
  san?: string; 
  promotion?: string;
  isCapture?: boolean;
  fen?: string;
  currentFen?: string;
  resultingFen?: string;
  moveHistory?: string[];
}

@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'chess',
  transports: ['websocket'],
})
@Injectable()
export class GameGateway {
  private logger = new Logger(GameGateway.name);
  
  // Map to store chess instances by game ID for consistent state management
  private chessInstances: Map<string, Chess> = new Map();

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly gameManagerService: GameManagerService,
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
    private readonly disconnectionService: DisconnectionService,
    private readonly usersService: UsersService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly userActivityService: UserActivityService,
  ) {}

  /**
   * This method runs when the gateway is initialized
   */
  afterInit() {
    this.logger.log('Chess Game WebSocket Gateway Initialized');
    this.logger.warn(
      '⚠ GAME STATE WARNING: All game state is stored in-memory only. Restarting the server will clear all active games.',
    );
    // Set the server instance in the GameManagerService
    this.gameManagerService.setServer(this.server);
    this.logger.log('Server instance passed to GameManagerService');
  }

  /**
   * This method runs when a client connects
   */
  handleConnection(client: Socket) {
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
    }, 20000); // Increased to 20 seconds for better reconnection handling
    
    // Register disconnection with game manager for ongoing games
    this.gameManagerService.registerDisconnection(client.id, this.server);
    
    // Handle disconnection for active games
    this.disconnectionService.handlePlayerDisconnect(this.server, client.id);
  }

  @SubscribeMessage('timeout_occurred')
  handleTimeoutOccurred(
    @MessageBody() data: { gameId: string; playerColor: 'white' | 'black' },
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(`Timeout occurred in game ${data.gameId} for ${data.playerColor}`);

    const game = this.gameManagerService.getGame(data.gameId);
    if (!game) {
      this.logger.error(`Game ${data.gameId} not found for timeout`);
      return;
    }

    // Determine winner and loser based on the player who timed out
    const timeoutColor = data.playerColor === 'white' ? 'w' : 'b';
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chessInstance,
      game.whitePlayer.socketId,
      game.blackPlayer.socketId,
      timeoutColor as Color,
    );

    if (gameEndDetails) {
      this.logger.log(`Game ${data.gameId} ended due to timeout`);
      // Emit game_end event to all clients in the room with winner and loser colors
      this.server.to(data.gameId).emit('game_end', {
        reason: GameEndReason.TIMEOUT,
        result: gameEndDetails.result,
        winnerSocketId: gameEndDetails.winnerSocketId,
        loserSocketId: gameEndDetails.loserSocketId,
        winnerColor: gameEndDetails.result === GameResult.WHITE_WINS ? 'white' : (gameEndDetails.result === GameResult.BLACK_WINS ? 'black' : undefined),
        loserColor: gameEndDetails.result === GameResult.WHITE_WINS ? 'black' : (gameEndDetails.result === GameResult.BLACK_WINS ? 'white' : undefined),
      });

      // Update game state
      game.ended = true;
      game.result = gameEndDetails.result;
      game.endReason = GameEndReason.TIMEOUT;
    } else {
      this.logger.error(`Failed to determine game end details for timeout in game ${data.gameId}`);
    }
  }

  @SubscribeMessage('startMatchmaking')
  async handleStartMatchmaking(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    this.logger.log(
      `Client ${client.id} requested to start matchmaking: ${JSON.stringify(payload)}`,
    );
    try {
      if (!payload) throw new Error('Invalid payload for matchmaking');
      const firebaseUid = payload.firebaseUid || 'guest';
      const username = payload.username || `Player-${client.id.substring(0, 5)}`;
      let userId: string | undefined;
      let rating = 1500;
      let isGuest = true;
      let gamesPlayed = 0;
      if (firebaseUid !== 'guest') {
        try {
          const user = await this.usersService.findByFirebaseUid(firebaseUid);
          if (user) {
            userId = user.id;
            rating = user.rating;
            isGuest = false;
            gamesPlayed = user.gamesPlayed || 0;
            this.logger.log(`Found registered user: ${username} (${userId}), Rating: ${rating}, Games played: ${gamesPlayed}`);
          } else {
            this.logger.warn(`Firebase user ${firebaseUid} not found in database, treating as guest`);
          }
        } catch (error) {
          this.logger.error(`Error fetching user data for ${firebaseUid}: ${error.message}`, error.stack);
        }
      } else {
        this.logger.log(`User is a guest: ${username}`);
      }
      const gameOptions = {
        gameMode: payload.gameMode || 'Rapid',
        timeControl: payload.timeControl || '10+0',
        rated: payload.rated !== undefined ? payload.rated : true,
        preferredSide: payload.preferredSide || 'random',
      };
      this.logger.log(
        `Adding player ${client.id} to matchmaking queue with options: ${JSON.stringify(gameOptions)}, userId: ${userId || 'guest'}, rating: ${rating}`
      );
      this.matchmakingService.addPlayerToQueue(
        client,
        gameOptions,
        rating,
        userId,
        username,
        isGuest,
        payload.betChallengeId // Pass betChallengeId if present
      );
      if (userId) {
        this.userActivityService.registerActivity(userId); 
      }
      setTimeout(() => {
        this.logger.log(`Triggering immediate matchmaking check for player ${client.id}`);
        this.matchmakingService.processMatchmakingNow();
      }, 500);
      return {
        event: 'matchmakingStarted',
        data: {
          success: true,
          message: 'Matchmaking started',
          queueInfo: gameOptions
        },
      };
    } catch (error) {
      this.logger.error(`Error starting matchmaking for client ${client.id}:`, error.stack || error.message);
      client.emit('matchmakingError', {
        message: 'Failed to start matchmaking',
        error: error.message,
        retryAllowed: true
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
   * Handle a move being made on the client side
   */
  @SubscribeMessage('move_made')
  async handleMoveMade(@ConnectedSocket() client: Socket, @MessageBody() payload: MoveMadePayload) {
    try {
      this.logger.log(`Move made in game ${payload.gameId} by client ${client.id}: ${JSON.stringify({
        from: payload.from,
        to: payload.to,
        san: payload.san,
        player: payload.player
      })}`);

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
      
      // Get game from gameManagerService
      const game = this.gameManagerService.getGame(payload.gameId);
      
      // Handle case when game is not found
      if (!game) {
        this.logger.warn(`Game ${payload.gameId} not found for move_made event`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Game not found',
          },
        };
      }
      
      // Ensure game has a chess instance
      if (!game.chessInstance) {
        game.chessInstance = new Chess();
        this.logger.log(`Created new chess instance for game ${payload.gameId}`);
      }
      
      // Check if player is part of the game
      const isWhitePlayer = game.whitePlayer.socketId === client.id;
      const isBlackPlayer = game.blackPlayer.socketId === client.id;
      
      if (!isWhitePlayer && !isBlackPlayer) {
        this.logger.warn(`Client ${client.id} is not part of game ${payload.gameId}`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'You are not part of this game',
          },
        };
      }
      
      // Verify it's the player's turn
      const isWhiteTurn = game.chessInstance.turn() === 'w';
      if ((isWhiteTurn && !isWhitePlayer) || (!isWhiteTurn && !isBlackPlayer)) {
        this.logger.warn(`Move attempted out of turn in game ${payload.gameId}`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: 'Not your turn',
          },
        };
      }
      
      // Mark that this is no longer the first move
      if (payload.player === 'white' && game.isFirstMove) {
        game.isFirstMove = false;
      }
      
      // Update last move time
      game.lastMoveTime = new Date();
      
      // Apply the move
      let moveResult;
      try {
        if (payload.san) {
          moveResult = game.chessInstance.move(payload.san);
        } else {
          moveResult = game.chessInstance.move({
            from: payload.from!,
            to: payload.to!,
            promotion: payload.promotion ? payload.promotion.toLowerCase() as any : undefined
          });
        }
          
        if (!moveResult) {
          this.logger.error(`Invalid move attempted in game ${payload.gameId}`);
          return {
            event: 'moveMadeResponse',
            data: {
              success: false,
              message: 'Invalid move',
            },
          };
        }
      } catch (moveError) {
        this.logger.error(`Error applying move in game ${payload.gameId}: ${moveError.message}`);
        return {
          event: 'moveMadeResponse',
          data: {
            success: false,
            message: `Move error: ${moveError.message}`,
          },
        };
      }
      
      // Get the current game state after the move
      const fen = game.chessInstance.fen();
      const pgn = game.chessInstance.pgn();
      const moveHistory = game.chessInstance.history();
      const isGameOver = game.chessInstance.isGameOver();
      const isCheck = game.chessInstance.isCheck();
      
      // Update game state
      game.pgn = pgn;
      game.whiteTurn = !isWhiteTurn; // Toggle turn
      
      // Broadcast the move to all players in the game room
      this.server.to(payload.gameId).emit('move_made', {
        gameId: payload.gameId,
        from: moveResult.from,
        to: moveResult.to,
        san: moveResult.san,
        player: payload.player,
        isCapture: moveResult.flags.includes('c'),
        promotion: moveResult.promotion,
        fen: fen,
        pgn: pgn,
        moveHistory: moveHistory,
        isCheck: isCheck
      });
      
      // Also emit a board_updated event with full state
      this.server.to(payload.gameId).emit('board_updated', {
        gameId: payload.gameId,
        fen: fen,
        pgn: pgn,
        moveHistory: moveHistory,
        lastMove: moveResult.san,
        whiteTurn: game.chessInstance.turn() === 'w',
        isCapture: moveResult.flags.includes('c'),
        isCheck: isCheck,
        moveCount: Math.floor(game.chessInstance.moveNumber() / 2),
        isGameOver: isGameOver,
        timestamp: Date.now()
      });
      
      // Check for game end conditions
      if (isGameOver) {
        // Handle game end through the game manager service
        await this.gameManagerService.checkGameEnd(payload.gameId, this.server);
      }
      
      return {
        event: 'moveMadeResponse',
        data: {
          success: true,
          move: moveResult
        },
      };
      
    } catch (error) {
      this.logger.error(`Error in handleMoveMade: ${error.message}`);
      return {
        event: 'moveMadeResponse',
        data: {
          success: false,
          message: 'Internal server error processing move',
        },
      };
    }
  }

  /**
   * Handle a request for board state synchronization
   */
  @SubscribeMessage('request_board_sync')
  handleBoardSyncRequest(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string, reason: string, clientState?: string }) {
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
      
      // Get current game state
      const fen = game.chessInstance.fen();
      const pgn = game.chessInstance.pgn();
      const moveHistory = game.chessInstance.history();
      const isGameOver = game.chessInstance.isGameOver();
      const isCheck = game.chessInstance.isCheck();
      const whiteTurn = game.chessInstance.turn() === 'w';
      
      // Send the full board state back to the client
      client.emit('board_sync', {
        gameId: payload.gameId,
        fen: fen,
        pgn: pgn,
        moveHistory: moveHistory,
        whiteTurn: whiteTurn,
        isCheck: isCheck,
        isGameOver: isGameOver,
        timestamp: Date.now(),
        reason: payload.reason
      });
      
      return {
        event: 'boardSyncResponse',
        data: {
          success: true,
          message: 'Board state sent',
        },
      };
    } catch (error) {
      this.logger.error(`Error in handleBoardSyncRequest: ${error.message}`);
      return {
        event: 'boardSyncResponse',
        data: {
          success: false,
          message: 'Internal server error processing board sync request',
        },
      };
    }
  }
}