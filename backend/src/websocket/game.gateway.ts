import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from '../game/matchmaking.service';
import { GameManagerService } from '../game/game-manager.service';
import { GameEndService } from '../game/game-end/game-end.service';
import { RatingService } from '../game/rating/rating.service';

interface MatchmakingOptions {
  gameMode?: string;
  timeControl?: string;
  rated?: boolean;
  preferredSide?: string;
}

@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'chess',
  transports: ['websocket'],
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('GameGateway');

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly gameManagerService: GameManagerService,
    private readonly gameEndService: GameEndService,
    private readonly ratingService: RatingService,
  ) {}

  /**
   * This method runs when the gateway is initialized
   */
  afterInit() {
    this.logger.log('Chess Game WebSocket Gateway Initialized');
  }

  /**
   * This method runs when a client connects
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
    
    // Remove from matchmaking queue if they were in it
    this.matchmakingService.removePlayerFromQueue(client.id);
    
    // Register disconnection with game manager for ongoing games
    this.gameManagerService.registerDisconnection(client.id, this.server);
  }

  /**
   * Handle a client request to join a game
   */
  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket, payload: any) {
    this.logger.log(
      `Client ${client.id} requested to join game: ${JSON.stringify(payload)}`,
    );
    // For now, just acknowledge the request
    // In future implementations, this will handle actual game joining logic
    return {
      event: 'gameJoinResponse',
      data: {
        success: true,
        message: 'Request to join game received',
        gameId: `test-game-${Date.now()}`,
      },
    };
  }

  /**
   * Handle a client request to start matchmaking
   */
  @SubscribeMessage('startMatchmaking')
  handleStartMatchmaking(client: Socket, payload: MatchmakingOptions) {
    this.logger.log(
      `Client ${client.id} requested to start matchmaking: ${JSON.stringify(payload)}`,
    );
    
    try {
      // Add player to matchmaking queue
      this.matchmakingService.addPlayerToQueue(client, {
        gameMode: payload.gameMode || 'Blitz',
        timeControl: payload.timeControl || '5+0',
        rated: payload.rated !== undefined ? payload.rated : true,
      });
      
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
  handleMakeMove(client: Socket, payload: { gameId: string; move: string }) {
    this.logger.log(
      `Client ${client.id} made move ${payload.move} in game ${payload.gameId}`,
    );
    
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
        // Broadcast the move to all players in the game room
        this.server.to(payload.gameId).emit('move_made', {
          gameId: payload.gameId,
          move: payload.move,
          playerId: client.id,
          fen: game.chessInstance.fen(),
          pgn: game.pgn,
          isWhiteTurn: game.whiteTurn,
        });
        
        // Check if the game has ended after this move
        const gameResult = this.gameManagerService.checkGameEnd(
          payload.gameId,
          this.server,
        );
        
        if (gameResult) {
          // Game has ended, the gameEnd event has already been emitted
          // from within the gameManagerService
          return {
            event: 'moveMade',
            data: {
              success: true,
              message: 'Move made and game ended',
              gameEnd: true,
              result: gameResult,
            },
          };
        }
        
        return {
          event: 'moveMade',
          data: {
            success: true,
            message: 'Move made',
            gameEnd: false,
          },
        };
      }
    }
    
    return {
      event: 'moveMade',
      data: {
        success: false,
        message: moveSuccess ? 'Game not found' : 'Invalid move',
      },
    };
  }
  
  /**
   * Handle a client offer to draw
   */
  @SubscribeMessage('offer_draw')
  handleOfferDraw(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} offered a draw in game ${payload.gameId}`,
    );
    
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'drawOfferSent',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Update the game state to record the draw offer
    game.drawOfferBy = client.id;
    
    // Broadcast the draw offer to the opponent
    client.to(payload.gameId).emit('draw_offered', {
      gameId: payload.gameId,
      playerId: client.id,
    });
    
    return {
      event: 'drawOfferSent',
      data: {
        success: true,
        message: 'Draw offer sent to opponent',
      },
    };
  }

  /**
   * Handle a client accepting a draw
   */
  @SubscribeMessage('accept_draw')
  handleAcceptDraw(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} accepted a draw in game ${payload.gameId}`,
    );
    
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'drawAccepted',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Verify that there is a pending draw offer from the other player
    const drawOfferFromOtherPlayer = game.drawOfferBy && 
      game.drawOfferBy !== client.id;
    
    if (!drawOfferFromOtherPlayer) {
      return {
        event: 'drawAccepted',
        data: {
          success: false,
          message: 'No valid draw offer to accept',
        },
      };
    }
    
    // Register the draw agreement
    const gameResult = this.gameManagerService.registerDrawAgreement(
      payload.gameId,
      this.server,
    );
    
    if (gameResult) {
      return {
        event: 'drawAccepted',
        data: {
          success: true,
          message: 'Draw accepted',
          result: gameResult,
        },
      };
    }
    
    return {
      event: 'drawAccepted',
      data: {
        success: false,
        message: 'Failed to process draw acceptance',
      },
    };
  }

  /**
   * Handle a client declining a draw
   */
  @SubscribeMessage('decline_draw')
  handleDeclineDraw(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} declined a draw in game ${payload.gameId}`,
    );
    
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'drawDeclined',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Clear the draw offer
    game.drawOfferBy = undefined;
    
    // Broadcast the draw decline to the opponent
    client.to(payload.gameId).emit('draw_declined', {
      gameId: payload.gameId,
      playerId: client.id,
    });
    
    return {
      event: 'drawDeclined',
      data: {
        success: true,
        message: 'Draw declined',
      },
    };
  }

  /**
   * Handle a client resigning from a game
   */
  @SubscribeMessage('resign_game')
  handleResignGame(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} resigned from game ${payload.gameId}`,
    );
    
    const gameResult = this.gameManagerService.registerResignation(
      payload.gameId,
      client.id,
      this.server,
    );
    
    if (gameResult) {
      return {
        event: 'gameResigned',
        data: {
          success: true,
          message: 'Game resigned',
          result: gameResult,
        },
      };
    }
    
    return {
      event: 'gameResigned',
      data: {
        success: false,
        message: 'Failed to resign the game',
      },
    };
  }

  /**
   * Handle a client request to abort a game (before first move)
   */
  @SubscribeMessage('abort_game')
  handleAbortGame(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} requested to abort game ${payload.gameId}`,
    );
    
    const game = this.gameManagerService.getGame(payload.gameId);
    
    if (!game) {
      return {
        event: 'gameAborted',
        data: {
          success: false,
          message: 'Game not found',
        },
      };
    }
    
    // Check if the game can be aborted (first move not made yet)
    if (!game.isFirstMove) {
      return {
        event: 'gameAborted',
        data: {
          success: false,
          message: 'Cannot abort game after first move',
        },
      };
    }
    
    // Determine the color of the player aborting
    const isWhitePlayer = game.whitePlayer.socketId === client.id;
    
    // Register the disconnection, which will be processed as an abort
    // since we've verified that it's still the first move
    this.gameManagerService.registerDisconnection(client.id, this.server);
    
    // Emit game aborted event to all players
    this.server.to(payload.gameId).emit('game_aborted', {
      gameId: payload.gameId,
      playerId: client.id,
      playerColor: isWhitePlayer ? 'white' : 'black',
    });
    
    return {
      event: 'gameAborted',
      data: {
        success: true,
        message: 'Game aborted',
      },
    };
  }
  
  /**
   * Handle a timeout from a player
   */
  @SubscribeMessage('report_timeout')
  handleReportTimeout(client: Socket, payload: { gameId: string, color: 'w' | 'b' }) {
    this.logger.log(
      `Timeout reported for ${payload.color === 'w' ? 'white' : 'black'} in game ${payload.gameId}`,
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
    
    // Register the timeout
    const gameResult = this.gameManagerService.registerTimeout(
      payload.gameId,
      payload.color,
      this.server,
    );
    
    if (gameResult) {
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
  handleClaimDraw(client: Socket, payload: { gameId: string }) {
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
    const gameResult = this.gameManagerService.checkGameEnd(
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
} 