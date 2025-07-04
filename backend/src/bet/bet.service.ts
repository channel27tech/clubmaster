import { Injectable, Logger, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { BetChallenge, BetStatus, BetType, BetChallengeResponse, BetResult } from './bet.model';
import { UsersService } from '../users/users.service';
import { GameManagerService } from '../game/game-manager.service';
import { User } from '../users/entities/user.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
  private readonly logger = new Logger('BET');
  private activeBetChallenges: Map<string, BetChallenge> = new Map();
  private betsByGameId: Map<string, string> = new Map(); // Maps gameId to betId
  private readonly CHALLENGE_EXPIRY_MS = 60000; // 1 minute before challenge expires
  private readonly PROFILE_CONTROL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Inject the UsersService and GameManagerService
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => GameManagerService))
    private readonly gameManagerService: GameManagerService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
      this.logger.log(`No bet found for game ${gameId}`);
      return null;
    }

    const challenge = this.activeBetChallenges.get(betId);
    if (!challenge) {
      this.logger.log(`Bet challenge ${betId} not found for game result`);
      return null;
    }

    if (!challenge.challengerId || (challenge.opponentId === undefined && !isDraw)) {
      this.logger.error(`Bet challenge ${betId} is missing critical player IDs (challengerId: ${challenge.challengerId}, opponentId: ${challenge.opponentId})`);
      return null;
    }

    if (challenge.status !== BetStatus.ACCEPTED) {
      this.logger.warn(`Cannot record result for bet ${betId} with status ${challenge.status}`);
      return null;
    }

    challenge.status = BetStatus.COMPLETED;
    challenge.winnerId = winnerId === null ? undefined : winnerId;

    let loserId: string | undefined = undefined;
    if (winnerId && !isDraw) {
      loserId = winnerId === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
    }

    const now = new Date();
    const betResult: BetResult = {
      betId,
      gameId,
      winnerId: winnerId === null ? undefined : winnerId,
      loserId,
      isDraw,
      betType: challenge.betType,
    };

    if (!isDraw && winnerId) {
      switch (challenge.betType) {
        case BetType.RATING_STAKE:
          if (challenge.stakeAmount && loserId) {
            betResult.ratingChange = challenge.stakeAmount;
            await this.applyRatingStake(winnerId, loserId, challenge.stakeAmount);
          }
          break;
        case BetType.PROFILE_CONTROL:
          if (loserId) {
            const controlExpiry = new Date(now.getTime() + this.PROFILE_CONTROL_DURATION_MS);
            betResult.profileControlExpiry = controlExpiry;
            await this.applyProfileControl(winnerId, loserId, controlExpiry);
          }
          break;
        case BetType.PROFILE_LOCK:
          if (loserId) {
            const lockExpiry = new Date(now.getTime() + this.PROFILE_CONTROL_DURATION_MS);
            betResult.profileLockExpiry = lockExpiry;
            await this.applyProfileLock(winnerId, loserId, lockExpiry);
          }
          break;
      }
    }

    challenge.resultApplied = true;
    this.logger.log(`Recorded result for bet ${betId} - Winner DB ID: ${winnerId}, Loser DB ID: ${loserId}, Draw: ${isDraw}`);

    const server = this.gameManagerService.getServer();
    if (server) {
      try {
        const challengerUser = await this.usersService.findOne(challenge.challengerId) as User | null;
        if (!challengerUser) {
          this.logger.error(`Challenger user ${challenge.challengerId} not found`);
          return betResult;
        }

        let opponentUser: User | null = null;
        if (challenge.opponentId) {
          opponentUser = await this.usersService.findOne(challenge.opponentId) as User | null;
          if (!opponentUser) {
            opponentUser = await this.usersService.findByFirebaseUid(challenge.opponentId) as User | null;
          }
        }

        if (challenge.opponentId && !opponentUser) {
          this.logger.error(`Opponent user not found by either UUID or Firebase UID: ${challenge.opponentId}`);
          return betResult;
        }

        const challengerName = challengerUser.displayName || challengerUser.username || 'Challenger';
        const opponentName = opponentUser?.displayName || opponentUser?.username || 'Opponent';

        const payloadForChallenger = {
          ...betResult,
          isWinner: betResult.winnerId === challengerUser.id,
          opponentName,
          perspective: 'challenger',
          opponentDbId: opponentUser?.id,
        };

        this.logger.log(`Emitting bet_result to Challenger's room: ${challengerUser.id}`);
        server.to(challengerUser.id).emit('bet_result', payloadForChallenger);

        if (opponentUser) {
          const payloadForOpponent = {
            ...betResult,
            isWinner: betResult.winnerId === opponentUser.id,
            opponentName: challengerName,
            perspective: 'opponent',
            opponentDbId: challengerUser.id,
          };

          this.logger.log(`Emitting bet_result to Opponent's room: ${opponentUser.id}`);
          server.to(opponentUser.id).emit('bet_result', payloadForOpponent);
        } else {
          this.logger.warn(`No opponent user found for bet ${betId}. Cannot emit bet_result to opponent.`);
        }
      } catch (error) {
        this.logger.error(`Error emitting bet results: ${error.message}`);
        return betResult;
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
      // Always clear profile control for the winner (controller)
      await this.usersService.clearProfileControl(winnerId);
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

  // --- RESTORE PUBLIC API FOR CONTROLLER ---

  async applyProfileControlChanges(
    targetUserId: string,
    nickname?: string,
    avatarType?: string
  ): Promise<User> {
    const targetUser = await this.usersService.findOne(targetUserId);
    if (!targetUser) throw new NotFoundException(`User with ID ${targetUserId} not found`);
    const updateData: Partial<User> = {};
    if (nickname) updateData.controlledNickname = nickname;
    if (avatarType) updateData.controlledAvatarType = avatarType;
    return this.usersService.update(targetUserId, updateData);
  }

  async getProfileControlDetails(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
    let isControlled = false;
    let controlledBy: string | undefined = undefined;
    let expiresAt: Date | undefined = undefined;
    if (user.profileControlledBy && user.profileControlExpiry) {
      const expiryDate = new Date(user.profileControlExpiry);
      if (new Date() < expiryDate) {
        isControlled = true;
        controlledBy = user.profileControlledBy;
        expiresAt = expiryDate;
      } else {
        await this.usersService.clearProfileControl(userId);
      }
    }
    return {
      isControlled,
      controlledBy,
      expiresAt,
      controlledNickname: user.controlledNickname,
      controlledAvatarType: user.controlledAvatarType
    };
  }

  /**
   * Checks if the controller (by UUID) has control over the target user's profile
   * @param controllerId UUID of the controlling user (not Firebase UID)
   * @param targetUserId UUID of the target user
   */
  async checkProfileControl(controllerId: string, targetUserId: string): Promise<boolean> {
    this.logger.log(`[DEBUG] checkProfileControl: controllerId=${controllerId}, targetUserId=${targetUserId}`);
    const user = await this.usersService.findOne(targetUserId);
    this.logger.log(`[DEBUG] Target user: ${user ? JSON.stringify({profileControlledBy: user.profileControlledBy, profileControlExpiry: user.profileControlExpiry}) : 'not found'}`);
    if (!user) return false;
    if (!user.profileControlledBy || !user.profileControlExpiry) return false;
    const expiryDate = new Date(user.profileControlExpiry);
    // Both controllerId and profileControlledBy are UUIDs
    if (user.profileControlledBy === controllerId && new Date() < expiryDate) {
      this.logger.log('[DEBUG] checkProfileControl: Permission granted');
      return true;
    }
    this.logger.log('[DEBUG] checkProfileControl: Permission denied');
    return false;
  }

  async checkProfileLockStatus(userId: string): Promise<{ isLocked: boolean; expiresAt: Date | undefined }> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
    let isLocked = false;
    let expiresAt: Date | undefined = undefined;
    if (user.profileLocked && user.profileLockExpiry) {
      const expiryDate = new Date(user.profileLockExpiry);
      if (new Date() < expiryDate) {
        isLocked = true;
        expiresAt = expiryDate;
      } else {
        await this.usersService.clearProfileLock(userId);
      }
    }
    return { isLocked, expiresAt };
  }

  /**
   * Atomically accept a bet challenge, create a game, and link them using a DB transaction
   */
  async acceptBetChallengeWithTransaction({
    challenge,
    responderId,
    responderSocket,
    usersService,
    gameManagerService,
    gameRepositoryService,
    dataSource,
  }: {
    challenge: BetChallenge,
    responderId: string,
    responderSocket: any,
    usersService: any,
    gameManagerService: any,
    gameRepositoryService: any,
    dataSource: any,
  }): Promise<{ game: any; dbGame: any }> {
    return await dataSource.transaction(async (manager) => {
      challenge.status = BetStatus.ACCEPTED;
      const responder = await usersService.findOne(responderId);
      if (!responder) throw new Error(`Responder not found: ${responderId}`);
      const challenger = await usersService.findOne(challenge.challengerId);
      if (!challenger) throw new Error(`Challenger not found: ${challenge.challengerId}`);

      let whitePlayerId, blackPlayerId;
      if (challenge.preferredSide === 'white') {
        whitePlayerId = challenge.challengerId;
        blackPlayerId = responderId;
      } else if (challenge.preferredSide === 'black') {
        whitePlayerId = responderId;
        blackPlayerId = challenge.challengerId;
      } else {
        const isChallengerWhite = Math.random() < 0.5;
        whitePlayerId = isChallengerWhite ? challenge.challengerId : responderId;
        blackPlayerId = isChallengerWhite ? responderId : challenge.challengerId;
      }

      const whitePlayer = {
        socketId: whitePlayerId === challenge.challengerId ? challenge.challengerSocketId : responderSocket.id,
        userId: whitePlayerId,
        username: whitePlayerId === challenge.challengerId ? challenger.displayName || challenger.username || 'Challenger' : responder.displayName || responder.username || 'Opponent',
        rating: whitePlayerId === challenge.challengerId ? challenger.rating || 1500 : responder.rating || 1500,
        isGuest: false,
        connected: true,
        photoURL: whitePlayerId === challenge.challengerId ? challenger.photoURL : responder.photoURL
      };
      const blackPlayer = {
        socketId: blackPlayerId === challenge.challengerId ? challenge.challengerSocketId : responderSocket.id,
        userId: blackPlayerId,
        username: blackPlayerId === challenge.challengerId ? challenger.displayName || challenger.username || 'Challenger' : responder.displayName || responder.username || 'Opponent',
        rating: blackPlayerId === challenge.challengerId ? challenger.rating || 1500 : responder.rating || 1500,
        isGuest: false,
        connected: true,
        photoURL: blackPlayerId === challenge.challengerId ? challenger.photoURL : responder.photoURL
      };

      // 1. Insert the game into the database with a unique ID
      let dbGame;
      let gameId: string;
      let attempts = 0;
      const maxAttempts = 3;
      const { v4: uuidv4 } = await import('uuid');
      while (attempts < maxAttempts) {
        gameId = uuidv4();
        try {
          dbGame = await manager.getRepository('Game').save({
            id: gameId,
            customId: gameId,
            whitePlayerId: whitePlayer.userId,
            blackPlayerId: blackPlayer.userId,
            status: 'ongoing',
            rated: true,
            whitePlayerRating: whitePlayer.rating,
            blackPlayerRating: blackPlayer.rating,
            timeControl: challenge.timeControl,
            pgn: '',
            moves: [],
            totalMoves: 0,
            endReason: `bet:${challenge.betType}:${challenge.id}`,
            betChallengeId: challenge.id,
          });
          break; // Success
        } catch (err) {
          if (err.code === '23505' || (err.message && err.message.includes('duplicate key value'))) {
            attempts++;
            continue; // Try again with a new UUID
          } else {
            throw err;
          }
        }
      }
      if (!dbGame || !dbGame.id) {
        throw new Error('Failed to create game in database after multiple attempts');
      }

      // 2. Now create the in-memory game with the same ID
      const game = gameManagerService.createGame(
        dbGame.id,
        whitePlayer,
        blackPlayer,
        challenge.gameMode,
        challenge.timeControl,
        true
      );
      gameManagerService.startGame(dbGame.id);

      challenge.gameId = dbGame.id;
      this.betsByGameId.set(dbGame.id, challenge.id);

      return { game, dbGame };
    });
  }
}