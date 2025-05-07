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
import { DisconnectionService } from '../game/disconnection.service';

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
    private readonly disconnectionService: DisconnectionService
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
    
    // Handle disconnection for active games
    this.disconnectionService.handlePlayerDisconnect(this.server, client.id);
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
   * Handle a client offer to draw
   */
  @SubscribeMessage('offer_draw')
  handleOfferDraw(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} offered a draw in game ${payload.gameId}`,
    );
    
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
    
    // Broadcast the draw acceptance to all players in the game
    this.server.to(payload.gameId).emit('draw_accepted', {
      gameId: payload.gameId,
      playerId: client.id,
    });
    
    return {
      event: 'drawAccepted',
      data: {
        success: true,
        message: 'Draw accepted',
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
    
    // Broadcast the resignation to all players in the game
    this.server.to(payload.gameId).emit('game_resigned', {
      gameId: payload.gameId,
      playerId: client.id,
    });
    
    return {
      event: 'gameResigned',
      data: {
        success: true,
        message: 'Game resigned',
      },
    };
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
  handleAbortGame(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} requested to abort game ${payload.gameId}`,
    );
    
    try {
      // Validate and handle the abort request
      const success = this.disconnectionService.handleAbortRequest(
        this.server,
        client.id,
        payload.gameId
      );
      
      return {
        event: 'abortGameResponse',
        data: {
          success,
          message: success ? 'Game successfully aborted' : 'Unable to abort game',
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
  handleMoveMade(client: Socket, payload: { gameId: string, from: string, to: string, player: string, notation: string }) {
    this.logger.log(
      `Move made in game ${payload.gameId} by ${payload.player}: ${payload.notation}`,
    );
    
    // If this is the first move by white, update the game state
    if (payload.player === 'white') {
      this.disconnectionService.markWhiteFirstMove(payload.gameId);
    }
    
    // Broadcast the move to all players in the game
    this.server.to(payload.gameId).emit('move_made', {
      gameId: payload.gameId,
      from: payload.from,
      to: payload.to,
      player: payload.player,
      notation: payload.notation,
      isCapture: payload.notation.includes('x'),
      isCheck: payload.notation.includes('+') || payload.notation.includes('#'),
    });
    
    return {
      event: 'moveMadeResponse',
      data: {
        success: true,
        message: 'Move broadcast to all players',
      },
    };
  }

  /**
   * Handle a player joining a game room
   */
  @SubscribeMessage('join_game_room')
  handleJoinGameRoom(client: Socket, payload: { gameId: string }) {
    this.logger.log(
      `Client ${client.id} is joining game room ${payload.gameId}`,
    );
    
    // Add the client to the game room
    client.join(payload.gameId);
    
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
} 