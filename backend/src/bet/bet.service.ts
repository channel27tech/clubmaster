import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { BetChallenge, BetStatus, BetType, BetChallengeResponse, BetResult } from './bet.model';
import { UsersService } from '../users/users.service';
import { GameManagerService } from '../game/game-manager.service';

// Define the missing interface
export interface CreateBetChallengeOptions {
  opponentId?: string;
  opponentSocketId?: string;
  betType: BetType;
  stakeAmount?: number;
  gameMode: string;
  timeControl: string;
  preferredSide: string;
}

@Injectable()
//
export class BetService {
  private readonly logger = new Logger(BetService.name);
  private activeBetChallenges: Map<string, BetChallenge> = new Map();
  private betsByGameId: Map<string, string> = new Map(); // Maps gameId to betId
  private readonly CHALLENGE_EXPIRY_MS = 60000; // 1 minute before challenge expires
  private readonly PROFILE_CONTROL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => GameManagerService))
    private readonly gameManagerService: GameManagerService,
  ) {}

  /**
   * Create a new bet challenge
   */
  createBetChallenge(
    client: Socket,
    challengerId: string,
    options: CreateBetChallengeOptions,
  ): BetChallenge {
    try {
      // Log incoming challenge request
      this.logger.log(`Creating bet challenge from ${challengerId.substring(0, 6)}... with options: ${JSON.stringify(options)}`);
      
      // Generate a unique ID for the challenge
      const betId = uuidv4();
      
      // Calculate expiry time (default: 60 seconds from now)
      const expiresAt = new Date(Date.now() + this.CHALLENGE_EXPIRY_MS);
      
      // Create new challenge object
      const betChallenge: BetChallenge = {
        id: betId,
        challengerId: challengerId,
        challengerSocketId: client.id,
        opponentId: options.opponentId,
        opponentSocketId: options.opponentSocketId,
        betType: options.betType,
        stakeAmount: options.betType === BetType.RATING_STAKE ? options.stakeAmount : undefined,
        gameMode: options.gameMode,
        timeControl: options.timeControl,
        preferredSide: options.preferredSide,
        createdAt: new Date(),
        expiresAt: expiresAt,
        status: BetStatus.PENDING,
        resultApplied: false,
      };
      
      // Add challenge to active challenges
      this.activeBetChallenges.set(betId, betChallenge);
      
      // Log successful creation
      this.logger.log(`Created bet challenge ${betId} from ${challengerId.substring(0, 6)}...`);
      
      // Set up expiry timeout for this challenge
      setTimeout(() => {
        this.expireBetChallenge(betId);
      }, this.CHALLENGE_EXPIRY_MS);
      
      return betChallenge;
    } catch (error) {
      this.logger.error(`Error creating bet challenge from ${challengerId.substring(0, 6)}...: ${error.message}`, error.stack);
      throw new Error(`Failed to create bet challenge: ${error.message}`);
    }
  }

  /**
   * Expire a bet challenge that hasn't been responded to
   */
  private expireBetChallenge(betId: string): void {
    const challenge = this.activeBetChallenges.get(betId);
    if (challenge && challenge.status === BetStatus.PENDING) {
      challenge.status = BetStatus.EXPIRED;
      this.logger.log(`Bet challenge ${betId} expired`);
      
      // Notify the challenger that the challenge expired
      const server = this.gameManagerService.getServer();
      if (server && challenge.challengerSocketId) {
        server.to(challenge.challengerSocketId).emit('bet_challenge_expired', { betId });
      }
    }
  }

  /**
   * Cancel a bet challenge
   */
  cancelBetChallenge(betId: string, challengerId: string): boolean {
    const challenge = this.activeBetChallenges.get(betId);
    if (!challenge) {
      this.logger.warn(`Bet challenge ${betId} not found for cancellation`);
      return false;
    }

    if (challenge.challengerId !== challengerId) {
      this.logger.warn(`User ${challengerId} not authorized to cancel bet challenge ${betId}`);
      return false;
    }

    if (challenge.status !== BetStatus.PENDING) {
      this.logger.warn(`Cannot cancel bet challenge ${betId} with status ${challenge.status}`);
      return false;
    }

    challenge.status = BetStatus.CANCELLED;
    this.logger.log(`Bet challenge ${betId} cancelled by ${challengerId}`);
    
    // Notify the opponent if there is one
    if (challenge.opponentSocketId) {
      const server = this.gameManagerService.getServer();
      if (server) {
        server.to(challenge.opponentSocketId).emit('bet_challenge_cancelled', { betId });
      }
    }
    
    return true;
  }

  /**
   * Respond to a bet challenge (accept or reject)
   */
  respondToBetChallenge(
    response: BetChallengeResponse,
    responderSocket: Socket,
  ): BetChallenge | null {
    const challenge = this.activeBetChallenges.get(response.challengeId);
    if (!challenge) {
      this.logger.warn(`Bet challenge ${response.challengeId} not found for response`);
      return null;
    }

    if (challenge.status !== BetStatus.PENDING) {
      this.logger.warn(`Cannot respond to bet challenge ${response.challengeId} with status ${challenge.status}`);
      return null;
    }

    if (response.accepted) {
      challenge.status = BetStatus.ACCEPTED;
      this.logger.log(`Bet challenge ${response.challengeId} accepted by ${response.responderId}`);
    } else {
      challenge.status = BetStatus.REJECTED;
      this.logger.log(`Bet challenge ${response.challengeId} rejected by ${response.responderId}`);
    }

    // Notify the challenger of the response
    const server = this.gameManagerService.getServer();
    if (server) {
      server.to(challenge.challengerSocketId).emit('bet_challenge_response', {
        betId: challenge.id,
        accepted: response.accepted,
        responderId: response.responderId,
      });
    }

    return challenge;
  }

  /**
   * Link a bet challenge to a game
   */
  linkBetToGame(betId: string, gameId: string): boolean {
    const challenge = this.activeBetChallenges.get(betId);
    if (!challenge) {
      this.logger.warn(`Bet challenge ${betId} not found for linking to game`);
      return false;
    }

    challenge.gameId = gameId;
    this.betsByGameId.set(gameId, betId);
    this.logger.log(`Linked bet challenge ${betId} to game ${gameId}`);
    return true;
  }

  /**
   * Record the result of a game with a bet
   */
  async recordBetResult(
    gameId: string,
    winnerId: string | null,
    isDraw: boolean
  ): Promise<BetResult | null> {
    const betId = this.betsByGameId.get(gameId);
    if (!betId) {
      this.logger.warn(`No bet found for game ${gameId}`);
      return null;
    }

    const challenge = this.activeBetChallenges.get(betId);
    if (!challenge) {
      this.logger.warn(`Bet challenge ${betId} not found for game result`);
      return null;
    }

    if (challenge.status !== BetStatus.ACCEPTED) {
      this.logger.warn(`Cannot record result for bet ${betId} with status ${challenge.status}`);
      return null;
    }

    // Update bet status
    challenge.status = BetStatus.COMPLETED;
    challenge.winnerId = winnerId === null ? undefined : winnerId;
    
    // Determine loser if there is a winner
    let loserId: string | undefined = undefined;
    if (winnerId && !isDraw) {
      loserId = winnerId === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
    }

    // Create bet result object
    const now = new Date();
    const betResult: BetResult = {
      betId,
      gameId,
      winnerId: winnerId === null ? undefined : winnerId,
      loserId,
      isDraw,
    };

    // Apply appropriate effects based on bet type
    if (!isDraw && winnerId) {
      switch (challenge.betType) {
        case BetType.RATING_STAKE:
          if (challenge.stakeAmount && loserId) {
            betResult.ratingChange = challenge.stakeAmount;
            // Apply rating changes via Users service
            await this.applyRatingStake(winnerId, loserId, challenge.stakeAmount);
          }
          break;
          
        case BetType.PROFILE_CONTROL:
          if (loserId) {
            const controlExpiry = new Date(now.getTime() + this.PROFILE_CONTROL_DURATION_MS);
            betResult.profileControlExpiry = controlExpiry;
            // Apply profile control via Users service
            await this.applyProfileControl(winnerId, loserId, controlExpiry);
          }
          break;
          
        case BetType.PROFILE_LOCK:
          if (loserId) {
            const lockExpiry = new Date(now.getTime() + this.PROFILE_CONTROL_DURATION_MS);
            betResult.profileLockExpiry = lockExpiry;
            // Apply profile lock via Users service
            await this.applyProfileLock(winnerId, loserId, lockExpiry);
          }
          break;
      }
    }

    challenge.resultApplied = true;
    this.logger.log(`Recorded result for bet ${betId} - Winner: ${winnerId}, Draw: ${isDraw}`);
    
    // Notify both players of the bet result
    const server = this.gameManagerService.getServer();
    if (server) {
      if (challenge.challengerSocketId) {
        server.to(challenge.challengerSocketId).emit('bet_result', betResult);
      }
      if (challenge.opponentSocketId) {
        server.to(challenge.opponentSocketId).emit('bet_result', betResult);
      }
    }

    return betResult;
  }

  /**
   * Get a bet challenge by ID
   */
  getBetChallenge(betId: string): BetChallenge | null {
    return this.activeBetChallenges.get(betId) || null;
  }

  /**
   * Get all pending bet challenges for a user
   */
  getPendingBetChallengesForUser(userId: string): BetChallenge[] {
    const challenges: BetChallenge[] = [];
    
    for (const challenge of this.activeBetChallenges.values()) {
      if (challenge.status === BetStatus.PENDING && 
          (challenge.opponentId === userId || challenge.challengerId === userId)) {
        challenges.push(challenge);
      }
    }
    
    return challenges;
  }

  /**
   * Get a bet associated with a game
   */
  getBetForGame(gameId: string): BetChallenge | null {
    const betId = this.betsByGameId.get(gameId);
    if (!betId) {
      return null;
    }
    return this.activeBetChallenges.get(betId) || null;
  }

  /**
   * Apply rating stake changes
   */
  private async applyRatingStake(
    winnerId: string,
    loserId: string,
    stakeAmount: number
  ): Promise<void> {
    try {
      // Deduct rating from loser
      await this.usersService.updateRating(loserId, -stakeAmount);
      
      // Note: In this implementation, winner doesn't get the rating points
      // They only get normal ELO calculation from the game itself
      this.logger.log(`Applied rating stake: ${loserId} lost ${stakeAmount} points`);
    } catch (error) {
      this.logger.error(`Error applying rating stake: ${error.message}`);
    }
  }

  /**
   * Apply profile control
   */
  private async applyProfileControl(
    winnerId: string, 
    loserId: string,
    expiryDate: Date
  ): Promise<void> {
    try {
      // Set profile control flag on loser's account
      await this.usersService.setProfileControl(loserId, winnerId, expiryDate);
      this.logger.log(`Applied profile control: ${winnerId} controls ${loserId}'s profile until ${expiryDate}`);
    } catch (error) {
      this.logger.error(`Error applying profile control: ${error.message}`);
    }
  }

  /**
   * Apply profile lock
   */
  private async applyProfileLock(
    winnerId: string,
    loserId: string,
    expiryDate: Date
  ): Promise<void> {
    try {
      // Set profile lock flag on loser's account
      await this.usersService.setProfileLock(loserId, expiryDate);
      this.logger.log(`Applied profile lock: ${loserId}'s profile locked until ${expiryDate}`);
    } catch (error) {
      this.logger.error(`Error applying profile lock: ${error.message}`);
    }
  }
} 