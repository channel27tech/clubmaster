import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { GameManagerService } from './game-manager.service';
import { GameRepositoryService } from './game-repository.service';
import { UsersService } from '../users/users.service';
import { BetService } from '../bet/bet.service';
import { v4 as uuidv4 } from 'uuid';
import { GameNotificationHelper } from './game-notification.helper';
import { Game } from './entities/game.entity';

interface Player {
  socketId: string;
  rating: number;
  socket: Socket;
  gameMode: string;
  timeControl: string;
  rated: boolean;
  preferredSide?: string;
  joinedAt: Date;
  userId?: string;
  username?: string;
  isGuest?: boolean;
  gamesPlayed?: number;
  betChallengeId?: string; // ID of associated bet challenge
}

interface GameOptions {
  gameMode: string;
  timeControl: string;
  rated: boolean;
  preferredSide?: string;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private matchmakingQueue: Map<string, Player> = new Map();
  private disconnectedPlayers: Map<string, { player: Player; disconnectedAt: Date }> = new Map();
  private readonly RECONNECT_GRACE_PERIOD = 15000; // 15 seconds grace period for reconnection
  private matchmakingIntervalId: NodeJS.Timeout | null = null;
  private readonly MATCHMAKING_INTERVAL = 2000; // Check for matches every 2 seconds
  private readonly MATCH_RATING_DIFFERENCE = 200; // Maximum rating difference for matching players

  constructor(
    private readonly gameManagerService: GameManagerService,
    private readonly gameRepositoryService: GameRepositoryService,
    private readonly usersService: UsersService,
    private readonly betService: BetService,
    private readonly gameNotificationHelper: GameNotificationHelper,
  ) {
    this.startMatchmakingProcess();

    // Add a warning about in-memory game storage
    this.logger.warn('⚠ Game state is in-memory only. Restarting the server clears all games.');
  }

  /**
   * Add a player to the matchmaking queue
   */
  addPlayerToQueue(
    socket: Socket,
    options: GameOptions,
    playerRating: number = 1500, // Default rating for new players
    userId?: string, // Database UUID for registered users
    username?: string, // Display name
    isGuest: boolean = true, // Whether the player is a guest
    betChallengeId?: string, // ID of associated bet challenge
  ): void {
    const socketId = socket.id;

    // Check if player is already in queue
    if (this.matchmakingQueue.has(socketId)) {
      this.logger.log(`Player ${socketId} is already in the matchmaking queue`);
      return;
    }

    // Standardize options for "Play Random" to ensure consistent matching
    // If this is a generic "Play Random" request (no bet challenge)
    if (!betChallengeId) {
      // Standardize game options for better matching
      options = {
        gameMode: options.gameMode || 'Blitz',
        timeControl: options.timeControl || '5+0',
        rated: options.rated !== undefined ? options.rated : true,
        preferredSide: options.preferredSide || 'random'
      };
      
      this.logger.log(`Standardized "Play Random" options for player ${socketId}: ${JSON.stringify(options)}`);
    }

    // Add player to queue with user information
    this.matchmakingQueue.set(socketId, {
      socketId,
      rating: playerRating,
      socket,
      gameMode: options.gameMode,
      timeControl: options.timeControl,
      rated: options.rated,
      preferredSide: options.preferredSide,
      joinedAt: new Date(),
      userId: userId, // Database UUID
      username: username || `Player-${socketId.substring(0, 5)}`,
      isGuest: isGuest,
      gamesPlayed: 0,
      betChallengeId: betChallengeId, // Store bet challenge ID if provided
    });

    // Log detailed player information
    this.logger.log(
      `Player added to queue - socketId: ${socketId}, userId: ${userId || 'guest'}, ` +
      `rating: ${playerRating}, gameMode: ${options.gameMode}, timeControl: ${options.timeControl}, ` +
      `rated: ${options.rated}, preferredSide: ${options.preferredSide}, betChallengeId: ${betChallengeId || 'none'}`
    );

    // Log additional info if bet challenge is present
    if (betChallengeId) {
      this.logger.log(
        `Player ${socketId} added to matchmaking queue with bet challenge ${betChallengeId}`,
      );
    } else {
      this.logger.log(
        `Player ${socketId}${userId ? ` (User: ${userId})` : ' (Guest)'} added to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`,
      );
    }

    // Send acknowledgment to player
    socket.emit('matchmakingStatus', {
      status: 'queued',
      queuePosition: this.matchmakingQueue.size,
      estimatedWaitTime: this.estimateWaitTime(playerRating, options),
    });
  }

  /**
   * Remove a player from the matchmaking queue
   */
  removePlayerFromQueue(socketId: string, isDisconnect: boolean = false): void {
    const player = this.matchmakingQueue.get(socketId);

    if (player) {
      if (isDisconnect) {
        // Store the player in disconnected players map
        this.disconnectedPlayers.set(socketId, {
          player,
          disconnectedAt: new Date(),
        });

        this.logger.log(
          `Player ${socketId} temporarily removed from queue due to disconnect. Will be restored if reconnects within ${this.RECONNECT_GRACE_PERIOD}ms`,
        );
      }

      this.matchmakingQueue.delete(socketId);
      this.logger.log(
        `Player ${socketId} removed from matchmaking queue. Queue size: ${this.matchmakingQueue.size}`,
      );
    }
  }

  /**
   * Handle a player reconnecting
   */
  handlePlayerReconnect(socketId: string): void {
    const disconnectedEntry = this.disconnectedPlayers.get(socketId);

    if (disconnectedEntry) {
      const { player, disconnectedAt } = disconnectedEntry;
      const now = new Date();
      const timeSinceDisconnect = now.getTime() - disconnectedAt.getTime();

      if (timeSinceDisconnect <= this.RECONNECT_GRACE_PERIOD) {
        // Player reconnected within grace period, restore them to queue
        this.matchmakingQueue.set(socketId, player);
        this.logger.log(`Player ${socketId} reconnected within grace period, restored to queue`);

        // Remove from disconnected players
        this.disconnectedPlayers.delete(socketId);

        // Send acknowledgment to player
        player.socket.emit('matchmakingStatus', {
          status: 'queued',
          queuePosition: this.matchmakingQueue.size,
          estimatedWaitTime: this.estimateWaitTime(player.rating, {
            gameMode: player.gameMode,
            timeControl: player.timeControl,
            rated: player.rated,
            preferredSide: player.preferredSide,
          }),
        });
      } else {
        // Grace period expired, remove from disconnected players
        this.disconnectedPlayers.delete(socketId);
        this.logger.log(`Player ${socketId} reconnection grace period expired`);
      }
    }
  }

  /**
   * Start the matchmaking process
   */
  private startMatchmakingProcess(): void {
    if (this.matchmakingIntervalId) {
      clearInterval(this.matchmakingIntervalId);
    }

    this.matchmakingIntervalId = setInterval(() => {
      this.processMatchmaking();
    }, this.MATCHMAKING_INTERVAL);

    this.logger.log('Matchmaking process started');
  }

  /**
   * Stop the matchmaking process
   */
  stopMatchmakingProcess(): void {
    if (this.matchmakingIntervalId) {
      clearInterval(this.matchmakingIntervalId);
      this.matchmakingIntervalId = null;
      this.logger.log('Matchmaking process stopped');
    }
  }

  /**
   * Process matchmaking queue to find and create matches
   */
  private async processMatchmaking(): Promise<void> {
    this.logger.log(`Processing matchmaking queue with ${this.matchmakingQueue.size} players`);
    if (this.matchmakingQueue.size < 2) return;
    const players = Array.from(this.matchmakingQueue.values());
    const matchedPlayerIds = new Set<string>();
    players.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    for (let i = 0; i < players.length; i++) {
      const player1 = players[i];
      if (matchedPlayerIds.has(player1.socketId)) continue;
      if (!this.isSocketValid(player1.socket)) {
        this.logger.warn(`[normal games] Player ${player1.socketId} has invalid socket, removing from queue`);
        this.matchmakingQueue.delete(player1.socketId);
        continue;
      }
      for (let j = i + 1; j < players.length; j++) {
        const player2 = players[j];
        if (matchedPlayerIds.has(player2.socketId)) continue;
        if (!this.isSocketValid(player2.socket)) {
          this.logger.warn(`[normal games] Player ${player2.socketId} has invalid socket, removing from queue`);
          this.matchmakingQueue.delete(player2.socketId);
          continue;
        }
        // --- RANDOM PLAY MATCHING ---
        if (!player1.betChallengeId && !player2.betChallengeId &&
          player1.gameMode === player2.gameMode &&
          player1.timeControl === player2.timeControl &&
          player1.rated === player2.rated &&
            Math.abs(player1.rating - player2.rating) <= this.MATCH_RATING_DIFFERENCE) {
          this.logger.log(`[normal games] Trying to match: ${player1.socketId} (side: ${player1.preferredSide}) vs ${player2.socketId} (side: ${player2.preferredSide})`);
          const colorAssignment = this.assignPlayerColors(player1, player2);
          if (!colorAssignment || !colorAssignment.whitePlayer || !colorAssignment.blackPlayer) {
            this.logger.warn(`[normal games] Could not assign colors for ${player1.socketId} (side: ${player1.preferredSide}) and ${player2.socketId} (side: ${player2.preferredSide}) - skipping match.`);
            continue;
          } else {
            this.logger.log(`[normal games] Assigned colors: white=${colorAssignment.whitePlayer.socketId} (${colorAssignment.whitePlayer.preferredSide}), black=${colorAssignment.blackPlayer.socketId} (${colorAssignment.blackPlayer.preferredSide})`);
          }
          try {
            await this.createMatch(player1, player2);
            matchedPlayerIds.add(player1.socketId);
            matchedPlayerIds.add(player2.socketId);
          } catch (error) {
            this.logger.error(`[normal games] Error in createMatch: ${error.message}`);
          }
          break;
        }
        // --- BET GAME MATCHING (existing logic, not changed here) ---
        if (player1.betChallengeId && player2.betChallengeId && player1.betChallengeId === player2.betChallengeId) {
          // Existing bet logic (not changed in this patch)
          // ...
        }
      }
    }
    this.updateWaitTimeEstimates();
  }

  // New method for random play match creation
  private async createRandomPlayMatch(player1: Player, player2: Player): Promise<void> {
    const { whitePlayer, blackPlayer, whitePlayerSocketId, blackPlayerSocketId } = this.assignPlayerColors(player1, player2);
    const gameId = uuidv4();
    this.logger.log(`Creating random play game with ID: ${gameId}`);
    // Map Player to GamePlayer (add 'connected' and any required fields, ensure username is always a string)
    const whiteGamePlayer = {
      socketId: whitePlayer.socketId,
      userId: whitePlayer.userId,
      rating: whitePlayer.rating,
      username: whitePlayer.username || `Player-${whitePlayer.socketId.slice(0, 5)}`,
      isGuest: whitePlayer.isGuest || true,
      connected: true,
      gamesPlayed: whitePlayer.gamesPlayed || 0,
    };
    const blackGamePlayer = {
      socketId: blackPlayer.socketId,
      userId: blackPlayer.userId,
      rating: blackPlayer.rating,
      username: blackPlayer.username || `Player-${blackPlayer.socketId.slice(0, 5)}`,
      isGuest: blackPlayer.isGuest || true,
      connected: true,
      gamesPlayed: blackPlayer.gamesPlayed || 0,
    };
    const gameState = this.gameManagerService.createGame(
      gameId,
      whiteGamePlayer,
      blackGamePlayer,
      whitePlayer.gameMode || 'Rapid',
      whitePlayer.timeControl || '10+0',
      whitePlayer.rated !== undefined ? whitePlayer.rated : true,
    );
    if (!gameState) {
      this.logger.error(`Failed to create random play game ${gameId}`);
      throw new Error('Failed to create game in GameManagerService');
    }
    // Ensure the game is marked as started
    this.gameManagerService.startGame(gameId);
    // Remove both players from the queue
    this.matchmakingQueue.delete(player1.socketId);
    this.matchmakingQueue.delete(player2.socketId);
    // Notify both players with the same gameId
    const matchData = {
      gameId,
      timeControl: whitePlayer.timeControl,
      gameMode: whitePlayer.gameMode,
      rated: whitePlayer.rated,
      playerColor: 'white',
      opponentColor: 'black',
      whitePlayer: {
        socketId: whitePlayerSocketId,
        rating: whitePlayer.rating,
        username: whitePlayer.username || `Player-${whitePlayer.socketId.slice(0, 5)}`,
      },
      blackPlayer: {
        socketId: blackPlayerSocketId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayer.socketId.slice(0, 5)}`,
      },
    };
    // Send correct color info to each player
    try {
      whitePlayer.socket.emit('matchFound', { ...matchData, playerColor: 'white', opponentColor: 'black' });
      blackPlayer.socket.emit('matchFound', { ...matchData, playerColor: 'black', opponentColor: 'white' });
      this.logger.log(`Emitted matchFound to both players for random play game ${gameId}`);
    } catch (err) {
      this.logger.error(`Error emitting matchFound for random play: ${err}`);
    }
  }

  /**
   * Private method to create a match between two players
   */
  private async createMatch(player1: Player, player2: Player): Promise<void> {
    this.logger.log(`Creating match between ${player1.socketId} and ${player2.socketId}`);
    try {
      // Verify socket connections are still valid
      const player1SocketValid = this.isSocketValid(player1.socket);
      const player2SocketValid = this.isSocketValid(player2.socket);
      
      if (!player1SocketValid || !player2SocketValid) {
        this.logger.warn(
          `Socket validation issues when creating match: ` +
          `player1=${player1SocketValid}, player2=${player2SocketValid}`
        );
        // We'll continue anyway and try to create the match
      }
      // Get player colors based on preferences
      const { whitePlayer, blackPlayer, whitePlayerSocketId, blackPlayerSocketId } =
        this.assignPlayerColors(player1, player2);
      // Check if this is a bet game
      const betChallengeId = player1.betChallengeId || player2.betChallengeId;
      if (betChallengeId) {
        this.logger.log(`Creating match for bet challenge: ${betChallengeId}`);
      }
      // Generate a unique game ID
      const gameId = uuidv4();
      this.logger.log(`Generated game ID: ${gameId}`);
      // Generate a database UUID
      const dbGameId = uuidv4();
      this.logger.log(`Generated database UUID: ${dbGameId}`);
      // Create white player object
      const whiteGamePlayer = {
        socketId: whitePlayerSocketId,
        userId: whitePlayer.userId,
        rating: whitePlayer.rating,
        username: whitePlayer.username || `Player-${whitePlayerSocketId.substring(0, 5)}`,
        isGuest: whitePlayer.isGuest || true,
        connected: true,
        gamesPlayed: whitePlayer.gamesPlayed || 0,
      };
      // Create black player object
      const blackGamePlayer = {
        socketId: blackPlayerSocketId,
        userId: blackPlayer.userId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayerSocketId.substring(0, 5)}`,
        isGuest: blackPlayer.isGuest || true,
        connected: true,
        gamesPlayed: blackPlayer.gamesPlayed || 0,
      };
      this.logger.log(
        `Creating game in GameManagerService with ID: ${gameId}, dbGameId: ${dbGameId}, ` +
        `white: ${whiteGamePlayer.socketId} (${whiteGamePlayer.userId || 'guest'}), ` +
        `black: ${blackGamePlayer.socketId} (${blackGamePlayer.userId || 'guest'})`
      );
      // Create a new game with proper parameters
      const gameState = this.gameManagerService.createGame(
        gameId,
        whiteGamePlayer,
        blackGamePlayer,
        whitePlayer.gameMode || 'Rapid',
        whitePlayer.timeControl || '10+0',
        whitePlayer.rated !== undefined ? whitePlayer.rated : true,
      );
      if (!gameState) {
        this.logger.error(`GameManagerService failed to create game ${gameId}`);
        throw new Error('Failed to create game in GameManagerService');
      }
      this.logger.log(`Game ${gameId} successfully created in GameManagerService`);
      // Ensure the game is marked as started
      this.gameManagerService.startGame(gameId);
      // Handle bet challenge if it exists
      if (betChallengeId) {
        try {
          this.logger.log(`Linking bet challenge ${betChallengeId} to game ${gameId}`);
          // Link the bet challenge to the game
          const success = await this.betService.linkBetToGame(betChallengeId, gameId);
          if (success) {
            this.logger.log(`Successfully linked bet challenge ${betChallengeId} to game ${gameId}`);
          } else {
            this.logger.warn(`Failed to link bet challenge ${betChallengeId} to game ${gameId}`);
            // Consider if this should be a fatal error or not
            // For now, we'll continue as it's not critical to gameplay
          }
        } catch (error) {
          this.logger.error(`Error linking bet challenge to game: ${error.message}`, error.stack);
          // Non-fatal error - continue with game creation
        }
      } else {
        // Check for bet challenges between these players
        await this.checkAndLinkBetChallenge(whitePlayer.userId, blackPlayer.userId, gameId);
      }
      // Create a database record if at least one player is registered
      const bothPlayersAreRegistered =
        !whitePlayer.isGuest && !blackPlayer.isGuest && whitePlayer.userId && blackPlayer.userId;
      const atLeastOnePlayerIsRegistered =
        (!whitePlayer.isGuest && whitePlayer.userId) ||
        (!blackPlayer.isGuest && blackPlayer.userId);
      // Determine whether to save the game based on your business logic
      // Here we're choosing to save if at least one player is registered
      let savedGame: Game | null = null;
      if (atLeastOnePlayerIsRegistered) {
        try {
          this.logger.log(`Attempting to save game record to DB with customId: ${gameId} and dbId: ${dbGameId}.`);
          const gameData = {
            id: dbGameId,
            customId: gameId,
            whitePlayerId: whitePlayer.userId,
            blackPlayerId: blackPlayer.userId,
            gameMode: whitePlayer.gameMode || 'Rapid',
            timeControl: whitePlayer.timeControl || '10+0',
            rated: whitePlayer.rated !== undefined ? whitePlayer.rated : true,
            status: 'ongoing' as 'ongoing' | 'white_win' | 'black_win' | 'draw' | 'aborted',
            startTime: new Date(),
            pgn: '',
            whitePlayerRating: typeof whitePlayer.rating === 'number' ? whitePlayer.rating : 1500,
            blackPlayerRating: typeof blackPlayer.rating === 'number' ? blackPlayer.rating : 1500,
          };
          savedGame = await this.gameRepositoryService.create(gameData);
          if (!savedGame) {
            this.logger.error(`ERROR saving game record to DB: save returned null/undefined`);
            throw new Error('Failed to save game record to database');
          }
          gameState.dbGameId = dbGameId;
          this.logger.log(`Game record successfully saved to DB.`);
        } catch (error) {
          this.logger.error(`ERROR saving game record to DB: ${error.message}`);
          throw new Error(`Failed to save game record to database: ${error.message}`);
        }
      }
      // Remove players from the matchmaking queue
      this.logger.log(`Removing players from matchmaking queue: ${player1.socketId}, ${player2.socketId}`);
      this.matchmakingQueue.delete(player1.socketId);
      this.matchmakingQueue.delete(player2.socketId);
      // Only notify players after successful DB save
      this.logger.log(`Notifying players about match ${gameId}...`);
      await this.notifyPlayersAboutMatch(
        whitePlayer,
        blackPlayer,
        whitePlayerSocketId,
        blackPlayerSocketId,
        gameId,
      );
      // Send notifications to both players if they're registered users
      try {
        // Only send notifications if both players are registered users
        if (whitePlayer.userId && blackPlayer.userId) {
          // Send game invite notification to white player
          await this.gameNotificationHelper.sendGameInviteNotification(
            whitePlayer.userId,
            blackPlayer.userId,
            gameId,
            whitePlayer.timeControl || '10+0'
          );
          // Send game invite accepted notification to black player
          await this.gameNotificationHelper.sendGameInviteAcceptedNotification(
            blackPlayer.userId,
            whitePlayer.userId,
            gameId
          );
        }
      } catch (error) {
        this.logger.error(`Error sending game notifications: ${error.message}`, error.stack);
        // Non-fatal error - continue
      }
      this.logger.log(`Match creation completed successfully for game ${gameId}`);
    } catch (error) {
      this.logger.error(`Error creating match: ${error.message}`, error.stack);
      // Do NOT emit matchFound if game creation or DB save failed
      throw error;
    }
  }

  /**
   * Helper method to check if a socket is valid and connected
   */
  private isSocketValid(socket: Socket): boolean {
    if (!socket) return false;
    
    try {
      // Check if socket exists and has the connected property
      if (socket.connected === false) {
        return false;
      }
      
      // Check if socket has the emit function
      if (typeof socket.emit !== 'function') {
        return false;
      }
      
      // Additional check: try to access the socket's id
      const socketId = socket.id;
      if (!socketId) {
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error checking socket validity: ${error.message}`);
      return false;
    }
  }

  /**
   * Notify players about the match
   */
  private async notifyPlayersAboutMatch(
    whitePlayer: Player,
    blackPlayer: Player,
    whitePlayerSocketId: string,
    blackPlayerSocketId: string,
    gameId: string,
  ): Promise<void> {
    // Verify socket connections are still valid
    const whiteSocketValid = this.isSocketValid(whitePlayer.socket);
    const blackSocketValid = this.isSocketValid(blackPlayer.socket);
    
    if (!whiteSocketValid || !blackSocketValid) {
      this.logger.warn(
        `Socket validation issues when notifying players about match ${gameId}: ` +
        `white=${whiteSocketValid}, black=${blackSocketValid}`
      );
      
      // We'll continue anyway and try alternative notification methods
    }
    
    this.logger.log(`Notifying players about match ${gameId}`);
    
    // Check if this is a bet game
    const betChallengeId = whitePlayer.betChallengeId || blackPlayer.betChallengeId;

    // Create the game data object
    const gameData = {
      gameId,
      gameMode: whitePlayer.gameMode,
      timeControl: whitePlayer.timeControl,
      rated: whitePlayer.rated,
      created: new Date(),
      whitePlayer: {
        socketId: whitePlayerSocketId,
        rating: whitePlayer.rating,
        username: whitePlayer.username || `Player-${whitePlayerSocketId.substring(0, 5)}`,
      },
      blackPlayer: {
        socketId: blackPlayerSocketId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayerSocketId.substring(0, 5)}`,
      },
      // Add bet challenge ID if it exists
      ...(betChallengeId && { betChallengeId }),
    };

    this.logger.log(
      `Match created: ${gameId} between ${whitePlayer.socketId} (white) and ${blackPlayer.socketId} (black)`,
    );

    // Log if this is a bet game
    if (betChallengeId) {
      this.logger.log(`This is a bet game with bet challenge ID: ${betChallengeId}`);
    }

    // Prepare data for white player
    const whitePlayerData = {
      ...gameData,
      playerColor: 'white',
      opponentColor: 'black',
    };
    
    // Prepare data for black player
    const blackPlayerData = {
      ...gameData,
      playerColor: 'black',
      opponentColor: 'white',
    };

    try {
      // Notify white player through multiple channels
      let whiteNotified = false;
      
      // Primary method: direct socket emit
      if (whiteSocketValid) {
        this.logger.log(`Emitting matchFound to white player ${whitePlayerSocketId} with gameId: ${gameId}`);
        const whiteEmitSuccess = await this.safeEmit(whitePlayer.socket, 'matchFound', whitePlayerData);
        
        if (whiteEmitSuccess) {
          whiteNotified = true;
          this.logger.log(`Successfully notified white player ${whitePlayerSocketId} via direct socket`);
        } else {
          this.logger.warn(`Failed to emit matchFound to white player ${whitePlayerSocketId} via direct socket`);
        }
      }
      
      // Fallback: user room if registered user
      if (!whiteNotified && whitePlayer.userId) {
        this.logger.log(`Attempting to notify white player ${whitePlayer.userId} via user room`);
        try {
          const server = this.gameManagerService.getServer();
          if (server) {
            server.to(whitePlayer.userId).emit('matchFound', whitePlayerData);
            this.logger.log(`Emitted matchFound to white player ${whitePlayer.userId} via user room`);
            whiteNotified = true;
          }
        } catch (error) {
          this.logger.error(`Error notifying white player via user room: ${error.message}`);
        }
      }
      
      // Notify black player through multiple channels
      let blackNotified = false;
      
      // Primary method: direct socket emit
      if (blackSocketValid) {
        this.logger.log(`Emitting matchFound to black player ${blackPlayerSocketId} with gameId: ${gameId}`);
        const blackEmitSuccess = await this.safeEmit(blackPlayer.socket, 'matchFound', blackPlayerData);
        
        if (blackEmitSuccess) {
          blackNotified = true;
          this.logger.log(`Successfully notified black player ${blackPlayerSocketId} via direct socket`);
        } else {
          this.logger.warn(`Failed to emit matchFound to black player ${blackPlayerSocketId} via direct socket`);
        }
      }
      
      // Fallback: user room if registered user
      if (!blackNotified && blackPlayer.userId) {
        this.logger.log(`Attempting to notify black player ${blackPlayer.userId} via user room`);
        try {
          const server = this.gameManagerService.getServer();
          if (server) {
            server.to(blackPlayer.userId).emit('matchFound', blackPlayerData);
            this.logger.log(`Emitted matchFound to black player ${blackPlayer.userId} via user room`);
            blackNotified = true;
          }
        } catch (error) {
          this.logger.error(`Error notifying black player via user room: ${error.message}`);
        }
      }
  
      // Join both players to a game room for further communication
      try {
        if (whiteSocketValid) {
          whitePlayer.socket.join(gameId);
          this.logger.log(`White player ${whitePlayerSocketId} joined game room ${gameId}`);
        }
        
        if (blackSocketValid) {
          blackPlayer.socket.join(gameId);
          this.logger.log(`Black player ${blackPlayerSocketId} joined game room ${gameId}`);
        }
      } catch (joinError) {
        this.logger.error(`Error joining game room: ${joinError.message}`);
        // Non-fatal error, continue
      }
      
      // Log notification status
      if (whiteNotified && blackNotified) {
        this.logger.log(`Successfully notified both players about match ${gameId}`);
      } else if (whiteNotified) {
        this.logger.warn(`Only notified white player about match ${gameId}`);
      } else if (blackNotified) {
        this.logger.warn(`Only notified black player about match ${gameId}`);
      } else {
        this.logger.error(`Failed to notify both players about match ${gameId}`);
        throw new Error(`Failed to notify both players about match ${gameId}`);
      }
    } catch (error) {
      this.logger.error(`Error emitting matchFound events: ${error.message}`, error.stack);
      throw new Error(`Failed to notify players about match: ${error.message}`);
    }
  }

  /**
   * Helper method to safely emit an event to a socket with a promise
   * This allows us to handle the emit as an async operation
   */
  private safeEmit(socket: Socket, event: string, data: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isSocketValid(socket)) {
        this.logger.error(`Cannot emit ${event} to invalid socket`);
        resolve(false);
        return;
      }
      
      try {
        socket.emit(event, data);
        // Socket.IO doesn't provide a callback for successful emission
        // so we assume success if no error is thrown
        resolve(true);
      } catch (error) {
        this.logger.error(`Error emitting ${event}: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * Estimate wait time for a player based on queue size and rating
   */
  private estimateWaitTime(rating: number, options: GameOptions): string {
    // Count players with similar options
    let similarPlayersCount = 0;
    let ratingDifferenceSum = 0;

    for (const player of this.matchmakingQueue.values()) {
      if (
        player.gameMode === options.gameMode &&
        player.timeControl === options.timeControl &&
        player.rated === options.rated
      ) {
        similarPlayersCount++;
        ratingDifferenceSum += Math.abs(player.rating - rating);
      }
    }

    // Calculate average rating difference
    const avgRatingDifference =
      similarPlayersCount > 0
        ? ratingDifferenceSum / similarPlayersCount
        : this.MATCH_RATING_DIFFERENCE;

    // Base wait time on queue size and rating difference
    if (similarPlayersCount === 0) {
      return 'a few minutes'; // No similar players
    } else if (avgRatingDifference < 100 && similarPlayersCount > 1) {
      return 'less than 30 seconds'; // Close ratings and multiple similar players
    } else if (similarPlayersCount > 3) {
      return 'about a minute'; // Many similar players
    } else {
      return '1-2 minutes'; // Default case
    }
  }

  /**
   * Update wait time estimates for all players in queue
   */
  private updateWaitTimeEstimates(): void {
    for (const player of this.matchmakingQueue.values()) {
      const queuePosition = this.getQueuePosition(player);
      const estimatedWaitTime = this.estimateWaitTime(player.rating, {
        gameMode: player.gameMode,
        timeControl: player.timeControl,
        rated: player.rated,
      });

      player.socket.emit('matchmakingStatus', {
        status: 'queued',
        queuePosition,
        estimatedWaitTime,
        playersInQueue: this.matchmakingQueue.size,
      });
    }
  }

  /**
   * Get the position of a player in the queue (based on wait time)
   */
  private getQueuePosition(player: Player): number {
    const players = Array.from(this.matchmakingQueue.values());
    players.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    return players.findIndex((p) => p.socketId === player.socketId) + 1;
  }

  private assignPlayerColors(player1: Player, player2: Player) {
    this.logger.log(`[normal games][assignPlayerColors] player1: ${player1.socketId} (side: ${player1.preferredSide}), player2: ${player2.socketId} (side: ${player2.preferredSide})`);
    // Store side preferences for coordinated side assignment
    const player1SidePreference = player1.preferredSide || 'random';
    const player2SidePreference = player2.preferredSide || 'random';

    // Determine color assignments at the server to ensure consistency
    let player1Color: 'white' | 'black';
    let player2Color: 'white' | 'black';

    // CASE 1: One chooses White, one chooses Black - assign each player their selected side
    if (player1SidePreference === 'white' && player2SidePreference === 'black') {
      player1Color = 'white';
      player2Color = 'black';
      this.logger.log(`[normal games][assignPlayerColors] Matched white/black exactly.`);
    } else if (player1SidePreference === 'black' && player2SidePreference === 'white') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`[normal games][assignPlayerColors] Matched black/white exactly.`);
    }
    // CASE 2: One chooses White/Black, other chooses Random
    else if (player1SidePreference === 'white' && player2SidePreference === 'random') {
      player1Color = 'white';
      player2Color = 'black';
      this.logger.log(`[normal games][assignPlayerColors] Case 2: Player1 chose White, Player2 chose Random - assigned accordingly`);
    } else if (player1SidePreference === 'black' && player2SidePreference === 'random') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`[normal games][assignPlayerColors] Case 2: Player1 chose Black, Player2 chose Random - assigned accordingly`);
    } else if (player1SidePreference === 'random' && player2SidePreference === 'white') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`[normal games][assignPlayerColors] Case 2: Player1 chose Random, Player2 chose White - assigned accordingly`);
    } else if (player1SidePreference === 'random' && player2SidePreference === 'black') {
      player1Color = 'white';
      player2Color = 'black';
      this.logger.log(`[normal games][assignPlayerColors] Case 2: Player1 chose Random, Player2 chose Black - assigned accordingly`);
    }
    // CASE 3: Both choose Random - assign randomly
    else if (player1SidePreference === 'random' && player2SidePreference === 'random') {
      // Use timestamp for randomness
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`[normal games][assignPlayerColors] Case 3: Both chose Random - Player1 gets ${player1Color}`);
    }
    // CASE 4: Both choose same side (White or Black) - randomly assign
    else if (player1SidePreference === 'white' && player2SidePreference === 'white') {
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`[normal games][assignPlayerColors] Case 4: Both chose White - Player1 gets ${player1Color}`);
    } else if (player1SidePreference === 'black' && player2SidePreference === 'black') {
      const player1GetsBlack = Math.random() > 0.5;
      player1Color = player1GetsBlack ? 'black' : 'white';
      player2Color = player1GetsBlack ? 'white' : 'black';
      this.logger.log(`[normal games][assignPlayerColors] Case 4: Both chose Black - Player1 gets ${player1Color}`);
    }
    // Fallback
    else {
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`[normal games][assignPlayerColors] Fallback case - Player1 gets ${player1Color}`);
    }

    // Get the correct player objects based on assigned colors
    const whitePlayer = player1Color === 'white' ? player1 : player2;
    const blackPlayer = player1Color === 'white' ? player2 : player1;

    return {
      whitePlayer,
      blackPlayer,
      whitePlayerSocketId: whitePlayer.socketId,
      blackPlayerSocketId: blackPlayer.socketId,
    };
  }

  /**
   * Check if there's a bet challenge between two players and link it to the game
   * @param whitePlayerId User ID of the white player
   * @param blackPlayerId User ID of the black player
   * @param gameId Game ID to link the bet to
   */
  private async checkAndLinkBetChallenge(
    whitePlayerId: string | undefined,
    blackPlayerId: string | undefined,
    gameId: string,
  ): Promise<void> {
    if (!whitePlayerId || !blackPlayerId) {
      this.logger.debug('Cannot check for bet challenges: Missing player IDs');
      return;
    }

    try {
      // Get all pending bet challenges for both players
      const whitePlayerChallenges = this.betService.getPendingBetChallengesForUser(whitePlayerId);
      const blackPlayerChallenges = this.betService.getPendingBetChallengesForUser(blackPlayerId);

      // Find a challenge between these two players with status ACCEPTED
      const betChallenge = [...whitePlayerChallenges, ...blackPlayerChallenges].find(
        (challenge) =>
          challenge.status === 'accepted' &&
          ((challenge.challengerId === whitePlayerId && challenge.opponentId === blackPlayerId) ||
            (challenge.challengerId === blackPlayerId && challenge.opponentId === whitePlayerId)),
      );

      if (betChallenge) {
        this.logger.log(
          `Found bet challenge ${betChallenge.id} between players, linking to game ${gameId}`,
        );
        this.betService.linkBetToGame(betChallenge.id, gameId);
      }
    } catch (error) {
      this.logger.error(`Error checking for bet challenges: ${error.message}`, error.stack);
    }
  }

  /**
   * Process matchmaking specifically for a bet challenge
   * This method will immediately pair players with the same bet challenge ID
   * @param betChallengeId The ID of the bet challenge
   */
  processMatchmakingForBetChallenge(betChallengeId: string): void {
    this.logger.log(`Processing matchmaking specifically for bet challenge: ${betChallengeId}`);

    if (this.matchmakingQueue.size < 2) {
      this.logger.warn(
        `Not enough players in queue to match for bet challenge: ${betChallengeId}. Queue size: ${this.matchmakingQueue.size}`,
      );
      // Log all players in queue for debugging
      const allPlayers = Array.from(this.matchmakingQueue.values());
      this.logger.log(
        `Current queue contains: ${allPlayers.map((p) => `${p.socketId} (${p.userId || 'no-id'}${p.betChallengeId ? `, bet: ${p.betChallengeId}` : ''})`)}`,
      );
      return;
    }

    // Find players with this bet challenge ID
    const players = Array.from(this.matchmakingQueue.values());
    const betPlayers = players.filter((player) => player.betChallengeId === betChallengeId);

    this.logger.log(`Found ${betPlayers.length} players with bet challenge ID: ${betChallengeId}`);

    if (betPlayers.length < 2) {
      this.logger.warn(
        `Could not find 2 players with bet challenge ID: ${betChallengeId}, found: ${betPlayers.length}`,
      );

      // Log detailed info about all players in queue for debugging
      players.forEach((player, index) => {
        this.logger.log(
          `Player ${index + 1} in queue: socketId=${player.socketId}, userId=${player.userId || 'none'}, betChallengeId=${player.betChallengeId || 'none'}`,
        );
      });

      return;
    }

    if (betPlayers.length > 2) {
      this.logger.warn(
        `Found more than 2 players with bet challenge ID: ${betChallengeId}, using first 2`,
      );
    }

    // Get the first 2 players
    const player1 = betPlayers[0];
    const player2 = betPlayers[1];

    this.logger.log(
      `Creating match for bet challenge ${betChallengeId} between players: ${player1.socketId} (${player1.userId || 'no-id'}) and ${player2.socketId} (${player2.userId || 'no-id'})`,
    );

    // Create a match between these two players
    this.createMatch(player1, player2).catch((error) => {
      this.logger.error(
        `Error creating match for bet challenge ${betChallengeId}: ${error.message}`,
        error.stack,
      );
    });
  }

  /**
   * Add a player to the matchmaking queue without a socket connection
   * This is used for bet challenges where one player may have disconnected
   * but we still want to create the match
   */
  addPlayerToQueueWithoutSocket(
    userId: string,
    options: GameOptions,
    playerRating: number = 1500,
    username?: string,
    betChallengeId?: string,
  ): void {
    this.logger.log(
      `Adding player ${userId} to matchmaking queue without socket (bet challenge: ${betChallengeId || 'none'})`,
    );

    // Generate a virtual socket ID for this player
    const virtualSocketId = `virtual_${userId}_${Date.now()}`;

    // Create a dummy socket object with the minimum required properties
    const dummySocket = {
      id: virtualSocketId,
      emit: (event: string, data: any) => {
        this.logger.log(`Virtual socket ${virtualSocketId} would emit ${event}`);
        return true;
      },
      join: (room: string) => {
        this.logger.log(`Virtual socket ${virtualSocketId} would join room ${room}`);
        return {
          emit: (event: string, data: any) => {
            this.logger.log(
              `Virtual socket ${virtualSocketId} in room ${room} would emit ${event}`,
            );
            return true;
          },
        };
      },
      // Add any other required Socket.io methods as needed
    } as unknown as Socket;

    // Create a player object
    const player: Player = {
      socketId: virtualSocketId,
      userId: userId,
      username: username || `Player_${userId.substring(0, 6)}`,
      rating: playerRating,
      isGuest: false,
      joinedAt: new Date(),
      socket: dummySocket,
      gameMode: options.gameMode,
      timeControl: options.timeControl,
      rated: options.rated !== undefined ? options.rated : true,
      preferredSide: options.preferredSide,
      betChallengeId: betChallengeId,
    };

    // Add to the queue
    this.matchmakingQueue.set(virtualSocketId, player);
    this.logger.log(
      `Added virtual player ${virtualSocketId} (${userId}) to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`,
    );

    // If this is a bet challenge, immediately try to process matchmaking
    if (betChallengeId) {
      setTimeout(() => {
        this.logger.log(
          `Triggering immediate matchmaking check for virtual player with bet challenge ${betChallengeId}`,
        );
        this.processMatchmakingForBetChallenge(betChallengeId);
      }, 500);
    }
  }

  /**
   * Trigger immediate matchmaking processing
   * This can be called from outside to force an immediate matchmaking check
   * Useful for improving pairing speed when a new player joins
   */
  public async processMatchmakingNow(): Promise<void> {
    this.logger.log('Immediate matchmaking processing triggered');
    await this.processMatchmaking();
  }
}
