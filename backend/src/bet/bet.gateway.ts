import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { BetService } from './bet.service';
import { BetChallengeResponse, BetType } from './bet.model';
import { SocketAuthGuard } from '../auth/socket-auth.guard';
import { MatchmakingService } from '../game/matchmaking.service';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { WsException } from '@nestjs/websockets';
import { validate as isUuid } from 'uuid';

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
export class BetGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(BetGateway.name);

  // This is the constructor for the bet gateway
  constructor(
    private readonly betService: BetService,
    private readonly matchmakingService: MatchmakingService,
    private readonly usersService: UsersService,
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

  // This is the method that is used to handle the bet challenge requests
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('create_bet_challenge')
  async handleCreateBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BetChallengeOptions,
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
        if (ack)
          ack({
            success: false,
            message: 'User not authenticated or user ID missing/invalid after auth.',
          });
        throw new WsException(
          'User not authenticated or user ID missing/invalid after auth.',
        );
      }

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

      this.logger.log(
        `Received bet challenge request from authenticated user (DB ID) ${userId.substring(0, 6)}... for opponent (likely DB ID) ${opponentId?.substring(0, 6) || 'N/A'} with payload: ${JSON.stringify(payload)}`,
      );

      // Validate bet type
      const betType = this.validateBetType(payload.betType);
      if (!betType) {
        if (ack) ack({ success: false, message: 'Invalid bet type' });
        return;
      }

      // Create bet challenge
      const betChallenge = this.betService.createBetChallenge(client, userId, {
        opponentId: payload.opponentId,
        opponentSocketId: payload.opponentSocketId,
        betType,
        stakeAmount: payload.stakeAmount,
        gameMode: payload.gameMode || 'Rapid',
        timeControl: payload.timeControl || '10+0',
        preferredSide: payload.preferredSide || 'random',
      });

      // Get sender and opponent user details using the correct findOne method and database UUIDs
      const senderUser = await this.usersService.findOne(userId);
      let opponentUser: User | null | undefined = undefined;
      if (opponentId) {
        // Use UUID validation to avoid DB errors
        if (isUuid(opponentId)) {
          opponentUser = await this.usersService.findOne(opponentId);
        }
        if (!opponentUser) {
          // Fallback: try as Firebase UID
          opponentUser = await this.usersService.findByFirebaseUid(opponentId);
          if (opponentUser) {
            this.logger.log(`Opponent found by Firebase UID: ${opponentId}`);
          }
        }
      }

      if (!senderUser) {
        this.logger.error(
          `Sender user with DB ID ${userId} not found in database.`,
        );
        if (ack)
          ack({
            success: false,
            message: 'Sender user not found in database after auth and UID lookup.',
          });
        throw new WsException(
          'Sender user not found in database after auth and UID lookup.',
        );
      }

      // If this is a direct challenge, opponentUser must be found
      if (payload.opponentSocketId && !opponentUser) {
        this.logger.error(
          `Opponent user with DB ID ${opponentId} not found in database for direct challenge.`,
        );
        client.emit('bet_challenge_failed', {
          message: 'Opponent not found in database.',
        });
        if (ack)
          ack({
            success: false,
            message: 'Opponent not found in database.',
          });
        return;
      }

      // If there's a specific opponent socket ID (for direct challenges)
      if (payload.opponentSocketId) {
        this.logger.log(
          `Attempting to send bet challenge notification to socket ID: ${payload.opponentSocketId}`,
        );

        // Send challenge notification to opponent - Ensure opponentUser exists for this path
        if (!opponentUser) {
          this.logger.error(
            `Assertion failed: opponentUser is undefined in direct challenge emit block for socket ${client.id}.`,
          );
          client.emit('bet_challenge_failed', {
            message: 'Internal error: Opponent data missing.',
          });
          if (ack)
            ack({
              success: false,
              message: 'Internal error: Opponent data missing.',
            });
          return;
        }

        // Prepare notification payload
        const notificationPayload = {
          id: betChallenge.id,
          senderId: senderUser.id,
          // Use displayName as primary, username as fallback, or "Unknown Player" if both are missing
          senderUsername: senderUser.displayName || senderUser.username || "Unknown Player",
          // Include profile photo URL (custom photo takes priority over photoURL)
          senderPhotoURL: senderUser.custom_photo_base64 || senderUser.photoURL || null,
          betType: betChallenge.betType,
          stakeAmount: betChallenge.stakeAmount,
          gameMode: betChallenge.gameMode,
          timeControl: betChallenge.timeControl,
          preferredSide: betChallenge.preferredSide,
          createdAt: betChallenge.createdAt,
          opponentId: opponentUser.id,
          opponentSocketId: payload.opponentSocketId,
          senderRating: senderUser.rating,
          opponentRating: opponentUser.rating,
        };

        // Log the sender username and photo URL explicitly
        this.logger.log(
          `Preparing notification with sender username: "${notificationPayload.senderUsername}" (was: ${senderUser.username || 'null'}, displayName: ${senderUser.displayName || 'null'}) and photo URL: ${notificationPayload.senderPhotoURL ? 'provided' : 'not available'}`,
        );

        // PRIMARY METHOD: Emit to the opponent's user-specific room (identified by their DB User ID)
        this.logger.log(
          `Attempting to send bet challenge notification to opponent user room: ${opponentUser.id}`,
        );
        
        const roomEmitResult = this.server.to(opponentUser.id).emit('bet_challenge_received', notificationPayload);
        
        // Log details about the room emission
        const roomDetails = this.server.sockets.adapter.rooms.get(opponentUser.id);
        const socketsInRoom = roomDetails ? roomDetails.size : 0;
        this.logger.log(
          `Emitted 'bet_challenge_received' to room ${opponentUser.id}. Sockets in room: ${socketsInRoom}`,
        );

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
        // Check if socketsAny is a Map (has get and size)
        if (
          socketsAny &&
          typeof socketsAny.get === 'function' &&
          typeof socketsAny.size === 'number'
        ) {
          opponentSocket = socketsAny.get(payload.opponentSocketId);
        } else if (typeof socketsAny.values === 'function') {
          // Fallback for Socket.IO v4+ where sockets is a Map-like iterator
          const socketsArr = Array.from(socketsAny.values());
          opponentSocket = socketsArr.find(
            (s: unknown) => (s as Socket).id === payload.opponentSocketId
          ) as Socket | undefined;
          if (!opponentSocket) {
            this.logger.warn('Could not find opponent socket using fallback method.');
          }
        } else {
          this.logger.warn('Unable to access sockets map or iterator for opponent lookup.');
        }

        // FINAL: Only access .rooms if opponentSocket is defined and .rooms is a Set
        if (opponentSocket && opponentSocket.rooms instanceof Set) {
          this.logger.log(`Target socket ${payload.opponentSocketId} is in active sockets map with rooms: ${Array.from(opponentSocket.rooms).join(', ')}`);
        } else if (opponentSocket) {
          this.logger.warn(`Target socket ${payload.opponentSocketId} found, but has no valid rooms property (may not be a valid socket object).`);
        } else {
          this.logger.warn(`Target socket ${payload.opponentSocketId} not found in active sockets map. This may mean the user is not online.`);
        }
      } else if (!payload.opponentSocketId) {
        // Handle challenges without a specific opponentSocketId (e.e.g., matchmaking challenges)
        // For now, we assume direct challenges with socketId are the primary flow needing notification
        this.logger.warn(`Received bet challenge request without opponentSocketId from ${client.id} for user ${userId.substring(0, 6)}... - Assuming matchmaking or other flow where direct notification is not expected.`);
        // Implement logic for matchmaking challenges if needed
      }

      // Send successful acknowledgment back to the client
      if (ack) {
        this.logger.log(`Sending successful bet challenge acknowledgment to socket ${client.id} for bet ${betChallenge.id}`);
        ack({
          success: true,
          betId: betChallenge.id,
          expiresAt: betChallenge.expiresAt.toISOString(),
        });
      }
      
      // Also emit to the client for backward compatibility
      client.emit('bet_challenge_created', {
        success: true,
        betId: betChallenge.id,
        expiresAt: betChallenge.expiresAt,
      });
      
    } catch (error) {
      this.logger.error(`❌ Socket ${client.id}: Error handling bet challenge: ${error.message}`, error.stack);
      client.emit('bet_challenge_failed', { message: 'Failed to create or send bet challenge.', error: error.message });
      
      if (ack) {
        ack({ success: false, message: `Error creating bet challenge: ${error.message}` });
      }
    }
  }

  /**
   * Handle responses to bet challenges
   */
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('respond_to_bet_challenge')

  // This is the method that is used to handle the bet challenge responses
  async handleRespondToBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BetChallengeResponse,
  ) {
    try {
      this.logger.log(`Received bet challenge response from ${client.id} for challenge ${payload.challengeId}`);

      // Get user ID from authenticated socket
      const userId = client.data?.userId;
      if (!userId) {
        return {
          event: 'bet_response_error',
          data: { success: false, message: 'User not authenticated' },
        };
      }

      // Update response with user ID
      const response: BetChallengeResponse = {
        ...payload,
        responderId: userId,
        responderSocketId: client.id,
      };

      // Process response
      const challenge = this.betService.respondToBetChallenge(response, client);
      if (!challenge) {
        return {
          event: 'bet_response_error',
          data: { success: false, message: 'Invalid bet challenge' },
        };
      }

      // If challenge was accepted, start matchmaking
      if (payload.accepted) {
        this.logger.log(`Starting matchmaking for bet challenge ${challenge.id}`);

        // Start matchmaking for both players
        const challengerSocket = this.safeGetSocket(challenge.challengerSocketId);
        if (!challengerSocket) {
          this.logger.warn(`Challenger socket ${challenge.challengerSocketId} not found`);
          return {
            event: 'bet_response_error',
            data: { success: false, message: 'Challenger no longer connected' },
          };
        }

        // Get player ratings
        const challenger = await this.usersService.findOne(challenge.challengerId);
        const responder = await this.usersService.findOne(userId);
        const challengerRating = challenger?.rating || 1500;
        const responderRating = responder?.rating || 1500;

        // Setup game options
        const mapTimeToGameMode = (timeControl: string): string => {
          if (timeControl.startsWith('3')) return 'Bullet';
          if (timeControl.startsWith('5')) return 'Blitz';
          return 'Rapid';
        };

        const gameOptions = {
          gameMode: challenge.gameMode || mapTimeToGameMode(challenge.timeControl),
          timeControl: challenge.timeControl,
          rated: true,
          preferredSide: challenge.preferredSide,
        };

        // Add both players to matchmaking queue
        this.matchmakingService.addPlayerToQueue(
          challengerSocket,
          gameOptions,
          challengerRating,
          challenge.challengerId,
          challenger?.displayName,
          false
        );

        this.matchmakingService.addPlayerToQueue(
          client,
          gameOptions,
          responderRating,
          userId,
          responder?.displayName,
          false
        );

        // Return success
        return {
          event: 'bet_response_success',
          data: {
            success: true,
            message: 'Bet challenge accepted, starting game',
          },
        };
      }

      // If challenge was rejected, just return success
      return {
        event: 'bet_response_success',
        data: {
          success: true,
          message: 'Bet challenge rejected',
        },
      };
    } catch (error) {
      this.logger.error(`Error responding to bet challenge: ${error.message}`, error.stack);
      return {
        event: 'bet_response_error',
        data: { success: false, message: 'Error processing bet challenge response' },
      };
    }
  }

  /**
   * Handle cancellation of bet challenges
   */
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('cancel_bet_challenge')
  async handleCancelBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { betId: string },
  ) {
    try {
      this.logger.log(`Received bet challenge cancellation from ${client.id} for challenge ${payload.betId}`);

      // Get user ID from authenticated socket
      const userId = client.data?.userId;
      if (!userId) {
        return {
          event: 'bet_cancel_error',
          data: { success: false, message: 'User not authenticated' },
        };
      }

      // Cancel challenge
      const success = this.betService.cancelBetChallenge(payload.betId, userId);
      if (!success) {
        return {
          event: 'bet_cancel_error',
          data: { success: false, message: 'Could not cancel bet challenge' },
        };
      }

      return {
        event: 'bet_cancel_success',
        data: {
          success: true,
          message: 'Bet challenge cancelled',
        },
      };
    } catch (error) {
      this.logger.error(`Error cancelling bet challenge: ${error.message}`, error.stack);
      return {
        event: 'bet_cancel_error',
        data: { success: false, message: 'Error cancelling bet challenge' },
      };
    }
  }

  /**
   * Get pending bet challenges for a user
   */
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('get_pending_bet_challenges')
  async handleGetPendingBetChallenges(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Get user ID from authenticated socket
      const userId = client.data?.userId;
      if (!userId) {
        return {
          event: 'bet_challenges_error',
          data: { success: false, message: 'User not authenticated' },
        };
      }

      // Get pending challenges
      const challenges = this.betService.getPendingBetChallengesForUser(userId);

      // Enhance challenges with challenger/opponent info
      const enhancedChallenges = await Promise.all(
        challenges.map(async (challenge) => {
          const isChallenger = challenge.challengerId === userId;
          const otherUserId = isChallenger ? challenge.opponentId : challenge.challengerId;
          
          let otherUser: User | null = null;
          if (otherUserId) {
            otherUser = await this.usersService.findOne(otherUserId);
          }

          return {
            ...challenge,
            otherUserName: otherUser?.displayName || 'Unknown Player',
            otherUserRating: otherUser?.rating || 1500,
            isChallenger,
          };
        })
      );

      return {
        event: 'pending_bet_challenges',
        data: {
          success: true,
          challenges: enhancedChallenges,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting pending bet challenges: ${error.message}`, error.stack);
      return {
        event: 'bet_challenges_error',
        data: { success: false, message: 'Error getting pending bet challenges' },
      };
    }
  }

  /**
   * Helper to validate bet type
   */
  private validateBetType(betTypeStr: string): BetType | null {
    switch (betTypeStr.toLowerCase()) {
      case 'profile_control':
        return BetType.PROFILE_CONTROL;
      case 'profile_lock':
        return BetType.PROFILE_LOCK;
      case 'rating_stake':
        return BetType.RATING_STAKE;
      default:
        return null;
    }
  }

  // Handle connection event for new socket clients with proper error handling
  handleConnection(client: Socket) {
    try {
      const userId = client.data?.userId;
      
      // If the client already has a userId from auth, join user-specific room
      if (userId) {
        client.join(userId);
        this.logger.log(`Socket ${client.id} joined user room ${userId}`);
        
        // Log the rooms that the socket is in for debugging
        const userRoom = this.server.sockets.adapter.rooms.get(userId);
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
}
