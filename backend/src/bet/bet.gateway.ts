import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { BetService, CreateBetChallengeOptions } from './bet.service';
import {
  BetChallenge,
  BetChallengeResponse,
  BetStatus,
  BetType,
} from './bet.model';
import { SocketAuthGuard } from '../firebase/socket-auth.guard';
import { MatchmakingService } from '../game/matchmaking.service';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { GameManagerService, GamePlayer } from '../game/game-manager.service';
import { GameRepositoryService } from '../game/game-repository.service';
import { DataSource } from 'typeorm';

// This is the interface for the bet challenge options
interface BetChallengeOptions {
  opponentId?: string;
  opponentSocketId?: string;
  betType: string;
  stakeAmount?: number;
  gameMode: string;
  timeControl: string;
  preferredSide: string;
}

// This is the gateway that is used to handle the bet challenges
@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'chess', // Use the same namespace as the game gateway
})

// This is the gateway that is used to handle the bet challenges
export class BetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('BET');
  private userSocketMap: Map<string, string> = new Map(); // Maps userId to current socketId

  // This is the constructor for the bet gateway
  constructor(
    private readonly betService: BetService,
    private readonly matchmakingService: MatchmakingService,
    private readonly usersService: UsersService,
    private readonly gameManagerService: GameManagerService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly dataSource: DataSource,
  ) {}

  // Handle connection event for new socket clients with proper error handling
  handleConnection(client: Socket) {
    try {
      const userId = client.data?.userId;
      
      // If the client already has a userId from auth, join user-specific room
      if (userId) {
        client.join(userId);
        this.logger.log(`Socket ${client.id} joined user room ${userId}`);
        
        // Store this socket ID in a map for quick lookup
        this.userSocketMap.set(userId, client.id);
        this.logger.log(`Updated socket map: User ${userId} is now using socket ${client.id}`);
        
        // Log the rooms that the socket is in for debugging
        const userRoom = this.server.sockets.adapter?.rooms?.get(userId);
        const socketsInRoom = userRoom ? userRoom.size : 0;
        this.logger.log(`User room ${userId} has ${socketsInRoom} connected sockets.`);
      } else {
        // Client has no userId yet, it may authenticate later via 'authenticate' event
        this.logger.debug(`Socket ${client.id} connected without authentication. Will join room when authenticated.`);
      }
    } catch (error) {
      // Catch any errors but don't disconnect the client - let authentication proceed
      this.logger.error(`Error in handleConnection for socket ${client.id}: ${error.message}`);
    }
  }

  // Handle disconnect event for socket clients
  handleDisconnect(client: Socket) {
    try {
      const userId = client.data?.userId;
      
      if (userId) {
        // Only remove from map if this is the current socket for this user
        if (this.userSocketMap.get(userId) === client.id) {
          this.userSocketMap.delete(userId);
          this.logger.log(`Removed socket mapping for user ${userId} (socket ${client.id})`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
    }
  }

  // This is the method that is used to handle the bet challenge requests
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('create_bet_challenge')
  async handleCreateBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any, // Use any here to avoid type errors with the client-sent payload
    ack?: (response: {
      success: boolean;
      betId?: string;
      expiresAt?: string;
      message?: string;
    }) => void,
  ) {
    try {
      // The user ID is now available on client.data from SocketAuthGuard after successful authentication
      // Ensure userId is a string (it should be the database UUID set in AuthGateway)
      const userId: string | undefined = (client.data as { userId?: string })?.userId;
      
      if (!userId || typeof userId !== 'string') {
        this.logger.error(
          `Socket ${client.id}: User ID not found or invalid on socket data after authentication.`,
        );
        if (ack) {
          ack({
            success: false,
            message: 'User not authenticated or user ID missing/invalid after auth.',
          });
        }
        throw new WsException(
          'User not authenticated or user ID missing/invalid after auth.',
        );
      }

      // Ensure user is in their room
      this.ensureUserInRoom(client, userId);

      // Ensure opponentId is provided for direct challenges (which use opponentSocketId)
      const opponentId: string | undefined = payload.opponentId;
      if (
        payload.opponentSocketId &&
        (!opponentId || typeof opponentId !== 'string')
      ) {
        this.logger.error(
          `Socket ${client.id}: Opponent ID not provided or invalid for direct challenge.`,
        );
        client.emit('bet_challenge_failed', {
          message: 'Opponent ID is required for direct challenges.',
        });
        if (ack)
          ack({
            success: false,
            message: 'Opponent ID is required for direct challenges.',
          });
        return;
      }

      // Create the bet challenge - convert string betType to enum
      const betTypeEnum = this.convertBetTypeStringToEnum(payload.betType);
      const createOptions: CreateBetChallengeOptions = {
        opponentId: payload.opponentId,
        opponentSocketId: payload.opponentSocketId,
        betType: betTypeEnum,
        stakeAmount: payload.stakeAmount,
        gameMode: payload.gameMode || 'Rapid',
        timeControl: payload.timeControl || '10+0',
        preferredSide: payload.preferredSide || 'random',
      };
      const challenge = this.betService.createBetChallenge(client, userId, createOptions);

      // Get the sender's username and photo URL for the notification
      const sender = await this.usersService.findOne(userId);
      const senderUsername = sender?.displayName || sender?.username || null;
      const senderPhotoURL = sender?.photoURL || null;
      
      this.logger.log(`User room ${userId} has ${this.server.sockets.adapter?.rooms?.get(userId)?.size || 0} connected sockets.`);

      // If this is a direct challenge, send notification to the opponent
      if (opponentId) {
        // Try to find the opponent by Firebase UID first
        let opponentUser: User | null = await this.usersService.findByFirebaseUid(opponentId);
        if (opponentUser) {
          this.logger.log(`Opponent found by Firebase UID: ${opponentId}`);
        } else {
          // If not found by Firebase UID, try by database ID
          opponentUser = await this.usersService.findOne(opponentId);
          if (opponentUser) {
            this.logger.log(`Opponent found by database ID: ${opponentId}`);
          } else {
            this.logger.error(`Opponent not found: ${opponentId}`);
            client.emit('bet_challenge_failed', {
              message: 'Opponent not found.',
            });
            if (ack)
              ack({
                success: false,
                message: 'Opponent not found.',
              });
            return;
          }
        }
        
        this.logger.log(`Attempting to send bet challenge notification to socket ID: ${payload.opponentSocketId}`);
        
        // Prepare the notification payload
        const notificationPayload = {
          id: challenge.id,
          challengerId: userId,
          challengerName: senderUsername,
          challengerPhotoURL: senderPhotoURL,
          betType: payload.betType,
          stakeAmount: payload.stakeAmount,
          gameMode: payload.gameMode,
          timeControl: payload.timeControl,
          expiresAt: challenge.expiresAt,
          senderId: userId,
          senderUsername: senderUsername,
        };
        
        this.logger.log(`Preparing notification with sender username: "${senderUsername}" (was: ${sender?.username}, displayName: ${sender?.displayName}) and photo URL: ${senderPhotoURL ? 'provided' : 'not provided'}`);

        // Find all sockets for this opponent
        if (opponentUser) {
          const opponentSockets = await this.findSocketsByUserId(opponentUser.id);
          this.logger.log(`Found ${opponentSockets.length} sockets for user ${opponentUser.id}`);
          
          if (opponentSockets.length > 0) {
            // Join each socket to the user's room if not already joined
            for (const socket of opponentSockets) {
              if (!socket.rooms.has(opponentUser.id)) {
                socket.join(opponentUser.id);
                this.logger.log(`Socket ${socket.id} joined user room ${opponentUser.id} (via handleCreateBetChallenge)`);
              }
            }
            this.logger.log(`Found and ensured ${opponentSockets.length} sockets for user ${opponentUser.id} are in their room`);
          } else {
            this.logger.warn(`No active sockets found for user ${opponentUser.id}`);
          }

          // PRIMARY METHOD: Emit to the opponent's user-specific room (identified by their DB User ID)
          this.logger.log(
            `Attempting to send bet challenge notification to opponent user room: ${opponentUser.id}`,
          );
          
          const roomEmitResult = this.server.to(opponentUser.id).emit('bet_challenge_received', notificationPayload);
          
          // Log details about the room emission
          const roomDetails = this.server.sockets.adapter?.rooms?.get(opponentUser.id);
          const socketsInRoom = roomDetails ? roomDetails.size : 0;
          this.logger.log(
            `Emitted 'bet_challenge_received' to room ${opponentUser.id}. Sockets in room: ${socketsInRoom}`,
          );
        }

        // FALLBACK: Try direct socket ID emission as well for backward compatibility
        const emitted = this.server
          .to(payload.opponentSocketId)
          .emit('bet_challenge_received', notificationPayload);

        this.logger.log(
          `Emit result for socket ID ${payload.opponentSocketId}: ${emitted ? 'Success' : 'Failure/Socket not found'}`,
        );
        
        // Check if the opponent socket is actually in the server's sockets map (defensive)
        let opponentSocket: Socket | undefined;
        const socketsAny = this.server.sockets as any;
        
        try {
          // Modern Socket.IO v4 implementation
          if (this.server.sockets.sockets instanceof Map) {
            opponentSocket = this.server.sockets.sockets.get(payload.opponentSocketId);
          } else if (typeof socketsAny.sockets === 'object') {
            // Legacy Socket.IO implementation
            opponentSocket = socketsAny.sockets[payload.opponentSocketId];
          }
          
          if (!opponentSocket) {
            this.logger.warn(`Target socket ${payload.opponentSocketId} not found in active sockets map. This may mean the user is not online.`);
          }
        } catch (error) {
          this.logger.error(`Error checking for opponent socket: ${error.message}`);
        }

        // Send acknowledgment to the sender
        if (ack) {
          ack({
            success: true,
            betId: challenge.id,
            expiresAt: challenge.expiresAt.toISOString(),
          });
        }

        // Return success response
        return {
          event: 'bet_challenge_created',
          data: {
            success: true,
            betId: challenge.id,
            expiresAt: challenge.expiresAt,
          },
        };
      } else {
        // Handle open challenges (not implemented yet)
        client.emit('bet_challenge_failed', {
          message: 'Open challenges not supported yet.',
        });
        if (ack)
          ack({
            success: false,
            message: 'Open challenges not supported yet.',
          });
        return;
      }
    } catch (error) {
      this.logger.error(
        `❌ Socket ${client.id}: Error handling bet challenge: ${error.message}`,
      );
      client.emit('bet_challenge_failed', {
        message: 'Server error creating bet challenge.',
      });
      if (ack)
        ack({
          success: false,
          message: 'Server error creating bet challenge.',
        });
    }
  }

  /**
   * Handle responses to bet challenges
   */
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('respond_to_bet_challenge')
  async handleRespondToBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BetChallengeResponse,
  ) {
    try {
      const responderId = client.data?.userId;
      if (!responderId) {
        this.logger.error(`No user ID found for socket ${client.id} when responding to challenge`);
        client.emit('bet_challenge_response_error', { message: 'Authentication required' });
        return;
      }

      this.ensureUserInRoom(client, responderId);

      // Get the challenge by ID
      const challenge = await this.betService.getBetChallenge(payload.challengeId);
      if (!challenge) {
        this.logger.error(`Challenge ${payload.challengeId} not found`);
        client.emit('bet_challenge_response_error', { message: 'Challenge not found' });
        return;
      }

      // Accept or reject the bet challenge using a transaction for atomicity
      if (payload.accepted) {
        try {
          // Use the new transaction-based method
          const { game, dbGame } = await this.betService.acceptBetChallengeWithTransaction({
            challenge,
            responderId,
            responderSocket: client,
            usersService: this.usersService,
            gameManagerService: this.gameManagerService,
            gameRepositoryService: this.gameRepositoryService,
            dataSource: this.dataSource,
          });

          // Join both players to the game room and emit events as before
            const challengerSockets = await this.findSocketsByUserId(challenge.challengerId);
          const responderSocket = client;
            
            if (challengerSockets.length > 0 && responderSocket) {
            const challengerSocket = challengerSockets[0];
            challengerSocket.join(game.id);
            responderSocket.join(game.id);
            this.logger.log(`Both players joined game room ${game.id}`);
              challengerSocket.emit('enter_game_response', {
                success: true,
              gameId: game.id,
              whitePlayerId: dbGame.whitePlayerId,
              blackPlayerId: dbGame.blackPlayerId,
                startedFromBet: true
              });
              responderSocket.emit('enter_game_response', {
                success: true,
              gameId: game.id,
              whitePlayerId: dbGame.whitePlayerId,
              blackPlayerId: dbGame.blackPlayerId,
                startedFromBet: true
              });
          }

          // Add logging before emitting bet_game_ready
          this.logger.log('[BET] Emitting bet_game_ready to challenger:', {
            gameId: dbGame.id,
            betId: challenge.id,
            betType: challenge.betType
          });
            this.server.to(challenge.challengerId).emit('bet_game_ready', { 
            gameId: dbGame.id,
            betId: challenge.id,
            betType: challenge.betType
          });
          this.logger.log('[BET] Emitting bet_game_ready to responder:', {
            gameId: dbGame.id,
              betId: challenge.id,
              betType: challenge.betType
            });
            this.server.to(responderId).emit('bet_game_ready', { 
            gameId: dbGame.id,
              betId: challenge.id,
              betType: challenge.betType
            });
          this.logger.log(`Bet game created: ${game.id} (bet: ${challenge.id}, type: ${challenge.betType})`);
        } catch (error) {
          this.logger.error(`Error creating game for bet challenge ${challenge.id}: ${error.message}`, error.stack);
          client.emit('bet_challenge_response_error', { message: 'Failed to create game' });
        }
      } else {
        // If rejected, update status as before
        const response: BetChallengeResponse = {
          challengeId: payload.challengeId,
          responderId: responderId,
          accepted: false,
          responderSocketId: client.id
        };
        this.betService.respondToBetChallenge(response, client);
      }
    } catch (error) {
      this.logger.error(`Error processing bet challenge response: ${error.message}`, error.stack);
      client.emit('bet_challenge_response_error', { message: 'Server error processing response' });
    }
  }

  /**
   * Get the status of a bet challenge
   */
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('get_bet_challenge_status')
  async handleGetBetChallengeStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { betId: string },
    ack?: (response: {
      success: boolean;
      status?: string;
      betId?: string;
      message?: string;
    }) => void,
  ) {
    try {
      this.logger.log(`Received bet challenge status request from ${client.id} for challenge ${payload.betId}`);

      // Get user ID from authenticated socket
      const userId = client.data?.userId;
      if (!userId) {
        if (ack) {
          ack({
            success: false,
            message: 'User not authenticated',
          });
        }
        return {
          event: 'bet_status_error',
          data: { success: false, message: 'User not authenticated' },
        };
      }

      // Get the bet challenge
      const challenge = this.betService.getBetChallenge(payload.betId);
      if (!challenge) {
        if (ack) {
          ack({
            success: false,
            message: 'Bet challenge not found',
          });
        }
        return {
          event: 'bet_status_error',
          data: { success: false, message: 'Bet challenge not found' },
        };
        
      }

      // Check if the user is involved in this challenge
      if (challenge.challengerId !== userId && challenge.opponentId !== userId) {
        if (ack) {
          ack({
            success: false,
            message: 'User not involved in this bet challenge',
          });
        }
        return {
          event: 'bet_status_error',
          data: { success: false, message: 'User not involved in this bet challenge' },
        };
      }

      // Return the status
      const status = {
        betId: challenge.id,
        status: challenge.status,
        gameId: challenge.gameId,
      };

      if (ack) {
        ack({
          success: true,
          ...status,
        });
      }

      return {
        event: 'bet_status_success',
        data: {
          success: true,
          ...status,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting bet challenge status: ${error instanceof Error ? error.message : String(error)}`);
      if (ack) {
        ack({
          success: false,
          message: 'Server error getting bet challenge status',
        });
      }
      return {
        event: 'bet_status_error',
        data: { success: false, message: 'Server error getting bet challenge status' },
      };
    }
  }

  // Add a method to find all sockets for a user ID
  private async findSocketsByUserId(userId: string): Promise<Socket[]> {
    try {
      const sockets: Socket[] = [];
      const socketServer = this.server;
      
      // Get all connected sockets - handle Socket.IO v4 properly
      if (socketServer.sockets.sockets instanceof Map) {
        // Modern Socket.IO v4 implementation (Map)
        for (const [_, socket] of socketServer.sockets.sockets) {
          if (socket.data?.userId === userId) {
            sockets.push(socket);
          }
        }
      } else if (typeof socketServer.sockets.sockets === 'object') {
        // Legacy Socket.IO implementation (object)
        const socketsObj = socketServer.sockets.sockets as Record<string, Socket>;
        for (const socketId in socketsObj) {
          const socket = socketsObj[socketId];
          if (socket.data?.userId === userId) {
            sockets.push(socket);
          }
        }
      }
      
      return sockets;
    } catch (error) {
      this.logger.error(`Error finding sockets by user ID: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  // Add a method to ensure user is in their room
  private ensureUserInRoom(client: Socket, userId: string): void {
    try {
      // Check if client is already in the user room
      if (!client.rooms.has(userId)) {
        // If not, join the room
        client.join(userId);
        this.logger.log(`Socket ${client.id} joined user room ${userId} (via ensureUserInRoom)`);
      }

      // Log the rooms that the socket is in for debugging
      const userRoom = this.server.sockets.adapter?.rooms?.get(userId);
      const socketsInRoom = userRoom ? userRoom.size : 0;
      this.logger.log(`User room ${userId} has ${socketsInRoom} connected sockets.`);
    } catch (error) {
      this.logger.error(`Error ensuring user in room: ${error.message}`);
    }
  }
  
  // Helper method to convert string bet type to enum
  private convertBetTypeStringToEnum(betTypeStr: string): BetType {
    switch (betTypeStr.toLowerCase()) {
      case 'profile_control':
        return BetType.PROFILE_CONTROL;
      case 'profile_lock':
        return BetType.PROFILE_LOCK;
      case 'rating_stake':
        return BetType.RATING_STAKE;
      default:
        return BetType.PROFILE_CONTROL; // Default to profile control if unknown
    }
  }

  /**
   * Helper method to determine game mode from time control
   */
  private getGameModeFromTimeControl(timeControlStr: string): string {
    try {
      const minutes = parseInt(timeControlStr.split('+')[0]);
      // Exact matches first
      if (minutes === 3) return 'Bullet';
      if (minutes === 5) return 'Blitz';
      if (minutes === 10) return 'Rapid';
      // Fallback ranges
      if (minutes <= 3) return 'Bullet';
      if (minutes <= 5) return 'Blitz';
      return 'Rapid';
    } catch (error) {
      return 'Blitz'; // Default fallback
    }
  }
}
