import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
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
export class BetGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(BetGateway.name);

  // This is the constructor for the bet gateway
  constructor(
    private readonly betService: BetService,
    private readonly matchmakingService: MatchmakingService,
    private readonly usersService: UsersService,
  ) {}

  // This is the method that is used to handle the bet challenge requests
  @UseGuards(SocketAuthGuard)
  @SubscribeMessage('create_bet_challenge')
  async handleCreateBetChallenge(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BetChallengeOptions,
  ) {
    try {
      this.logger.log(`Received bet challenge request from ${client.id}`);

      // Get user ID from authenticated socket
      const userId = client.data?.userId;
      if (!userId) {
        return {
          event: 'bet_challenge_error',
          data: { success: false, message: 'User not authenticated' },
        };
      }

      // Validate bet type
      const betType = this.validateBetType(payload.betType);
      if (!betType) {
        return {
          event: 'bet_challenge_error',
          data: { success: false, message: 'Invalid bet type' },
        };
      }

      // Create bet challenge
      const betChallenge = this.betService.createBetChallenge(
        client,
        userId,
        {
          opponentId: payload.opponentId,
          opponentSocketId: payload.opponentSocketId,
          betType,
          stakeAmount: payload.stakeAmount,
          gameMode: payload.gameMode || 'Rapid',
          timeControl: payload.timeControl || '10+0',
          preferredSide: payload.preferredSide || 'random',
        },
      );

      // If there's a specific opponent, notify them
      if (payload.opponentSocketId) {
        // Get opponent username
        const challenger = await this.usersService.findOne(userId);
        const challengerName = challenger?.displayName || 'Unknown Player';
        const challengerRating = challenger?.rating || 1500;

        // Send challenge notification to opponent
        this.server.to(payload.opponentSocketId).emit('bet_challenge_received', {
          betId: betChallenge.id,
          challengerId: userId,
          challengerName,
          challengerRating,
          betType: betChallenge.betType,
          stakeAmount: betChallenge.stakeAmount,
          gameMode: betChallenge.gameMode,
          timeControl: betChallenge.timeControl,
          expiresAt: betChallenge.expiresAt,
        });
      }

      return {
        event: 'bet_challenge_created',
        data: {
          success: true,
          betId: betChallenge.id,
          expiresAt: betChallenge.expiresAt,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating bet challenge: ${error.message}`, error.stack);
      return {
        event: 'bet_challenge_error',
        data: { success: false, message: 'Error creating bet challenge' },
      };
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
        const challengerSocket = this.server.sockets.sockets.get(challenge.challengerSocketId);
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
}
