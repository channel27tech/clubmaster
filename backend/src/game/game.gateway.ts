import { SubscribeMessage, MessageBody, ConnectedSocket, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { GameEndService, GameEndReason, GameResult } from './game-end/game-end.service';
import { Color } from 'chess.js';
import { MatchmakingService } from './matchmaking.service';
import { GameManagerService } from './game-manager.service';
import { RatingService } from './rating/rating.service';
import { DisconnectionService } from './disconnection.service';
import { UsersService } from '../users/users.service';
import { GameRepositoryService } from './game-repository.service';
import { UserActivityService } from '../users/user-activity.service';

@WebSocketGateway()
@Injectable()
export class GameGateway {
  private logger = new Logger(GameGateway.name);
  private games: Map<string, any> = new Map(); // Adjust type as per your game structure

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

  @SubscribeMessage('timeout_occurred')
  handleTimeoutOccurred(
    @MessageBody() data: { gameId: string; playerColor: 'white' | 'black' },
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(`Timeout occurred in game ${data.gameId} for ${data.playerColor}`);

    const game = this.games.get(data.gameId);
    if (!game) {
      this.logger.error(`Game ${data.gameId} not found for timeout`);
      return;
    }

    // Determine winner and loser based on the player who timed out
    const timeoutColor = data.playerColor === 'white' ? 'w' : 'b';
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chess,
      game.whitePlayerId,
      game.blackPlayerId,
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
      game.isGameOver = true;
      this.games.set(data.gameId, game);
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
        gameMode: payload.gameMode || 'Blitz',
        timeControl: payload.timeControl || '5+0',
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
}