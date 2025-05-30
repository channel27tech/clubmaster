import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { GameManagerService } from './game-manager.service';
import { GameRepositoryService } from './game-repository.service';
import { UsersService } from '../users/users.service';
import { BetService } from '../bet/bet.service';
import { v4 as uuidv4 } from 'uuid';

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
  ) {
    this.startMatchmakingProcess();
    
    // Add a warning about in-memory game storage
    this.logger.warn("⚠ Game state is in-memory only. Restarting the server clears all games.");
  }

  /**
   * Add a player to the matchmaking queue
   */
  addPlayerToQueue(
    socket: Socket, 
    options: GameOptions,
    playerRating: number = 1500, // Default rating for new players
    userId?: string,            // Database UUID for registered users
    username?: string,          // Display name
    isGuest: boolean = true     // Whether the player is a guest
  ): void {
    const socketId = socket.id;
    
    // Check if player is already in queue
    if (this.matchmakingQueue.has(socketId)) {
      this.logger.log(`Player ${socketId} is already in the matchmaking queue`);
      return;
    }
    
    // Add player to queue with user information
    this.matchmakingQueue.set(socketId, {
      socketId,
      rating: playerRating,
      socket,
      gameMode: options.gameMode || 'Blitz',
      timeControl: options.timeControl || '5+0',
      rated: options.rated !== undefined ? options.rated : true,
      preferredSide: options.preferredSide || 'random',
      joinedAt: new Date(),
      userId: userId,         // Database UUID
      username: username || `Player-${socketId.substring(0, 5)}`,
      isGuest: isGuest,
      gamesPlayed: 0
    });
    
    this.logger.log(
      `Player ${socketId}${userId ? ` (User: ${userId})` : ' (Guest)'} added to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`
    );
    
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
          disconnectedAt: new Date()
        });
        
        this.logger.log(`Player ${socketId} temporarily removed from queue due to disconnect. Will be restored if reconnects within ${this.RECONNECT_GRACE_PERIOD}ms`);
      }
      
      this.matchmakingQueue.delete(socketId);
      this.logger.log(`Player ${socketId} removed from matchmaking queue. Queue size: ${this.matchmakingQueue.size}`);
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
            preferredSide: player.preferredSide
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
  private processMatchmaking(): void {
    if (this.matchmakingQueue.size < 2) {
      return; // Need at least 2 players to make a match
    }
    
    const players = Array.from(this.matchmakingQueue.values());
    const matchedPlayerIds = new Set<string>();
    
    // Sort players by time in queue to prioritize players waiting longer
    players.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    
    for (let i = 0; i < players.length; i++) {
      const player1 = players[i];
      
      // Skip if player already matched
      if (matchedPlayerIds.has(player1.socketId)) {
        continue;
      }
      
      for (let j = 0; j < players.length; j++) {
        // Don't match player with self
        if (i === j) {
          continue;
        }
        
        const player2 = players[j];
        
        // Skip if player already matched
        if (matchedPlayerIds.has(player2.socketId)) {
          continue;
        }
        
        // Check if players have compatible game options
        if (
          player1.gameMode === player2.gameMode &&
          player1.timeControl === player2.timeControl &&
          player1.rated === player2.rated &&
          Math.abs(player1.rating - player2.rating) <= this.MATCH_RATING_DIFFERENCE
        ) {
          // Create a match between these two players
          this.createMatch(player1, player2);
          
          // Mark these players as matched
          matchedPlayerIds.add(player1.socketId);
          matchedPlayerIds.add(player2.socketId);
          
          // Remove matched players from queue
          this.matchmakingQueue.delete(player1.socketId);
          this.matchmakingQueue.delete(player2.socketId);
          
          break; // Move to next unmatched player
        }
      }
    }
    
    // Update wait time estimates for remaining players
    this.updateWaitTimeEstimates();
  }

  /**
   * Create a match between two players
   */
  private async createMatch(player1: Player, player2: Player): Promise<void> {
    // Determine the player colors (white/black)
    const {
      whitePlayer,
      blackPlayer,
      whitePlayerSocketId,
      blackPlayerSocketId,
    } = this.assignPlayerColors(player1, player2);

    // Generate a UUID for database storage
    const dbGameId = uuidv4();
    
    // Generate a user-friendly game ID for UI display
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const gameId = `game_${timestamp}_${randomSuffix}`;
    
    // Log the game IDs for debugging
    this.logger.log(`Creating game with database UUID: ${dbGameId} and custom ID: ${gameId}`);

    // Log detailed player information for debugging
    this.logger.log(`White player: ${whitePlayer.username || 'Unknown'} (${whitePlayer.userId || 'No User ID'}) - Guest: ${whitePlayer.isGuest ? 'Yes' : 'No'}`);
    this.logger.log(`Black player: ${blackPlayer.username || 'Unknown'} (${blackPlayer.userId || 'No User ID'}) - Guest: ${blackPlayer.isGuest ? 'Yes' : 'No'}`);

    // Get user info for non-guest players (this should be redundant as we now have playerIds already)
    let whitePlayerId = whitePlayer.userId;
    let blackPlayerId = blackPlayer.userId;

    // Verify that we can safely use these IDs (double-check) - Logging only
    if (whitePlayerId && !whitePlayer.isGuest) {
      try {
        const whiteUser = await this.usersService.findOne(whitePlayerId);
        if (whiteUser) {
          this.logger.log(`Verified white player ID ${whitePlayerId} (${whiteUser.displayName || 'Unknown'})`);
        } else {
          this.logger.warn(`White player ID ${whitePlayerId} not found in database!`);
        }
      } catch (e) {
        this.logger.error(`Error verifying white player: ${e.message}`);
      }
    } else if (whitePlayer.isGuest) {
      this.logger.log(`White player is a guest, no verification needed`);
    }

    if (blackPlayerId && !blackPlayer.isGuest) {
      try {
        const blackUser = await this.usersService.findOne(blackPlayerId);
        if (blackUser) {
          this.logger.log(`Verified black player ID ${blackPlayerId} (${blackUser.displayName || 'Unknown'})`);
        } else {
          this.logger.warn(`Black player ID ${blackPlayerId} not found in database!`);
        }
      } catch (e) {
        this.logger.error(`Error verifying black player: ${e.message}`);
      }
    } else if (blackPlayer.isGuest) {
      this.logger.log(`Black player is a guest, no verification needed`);
    }

    // Create GamePlayer objects from our Player objects
    const whiteGamePlayer = {
      socketId: whitePlayer.socketId,
      userId: whitePlayer.userId,
      rating: whitePlayer.rating,
      username: whitePlayer.username || `Player-${whitePlayer.socketId.substring(0, 5)}`,
      isGuest: whitePlayer.isGuest === false ? false : true,
      gamesPlayed: whitePlayer.gamesPlayed || 0,
      connected: true
    };

    const blackGamePlayer = {
      socketId: blackPlayer.socketId,
      userId: blackPlayer.userId,
      rating: blackPlayer.rating,
      username: blackPlayer.username || `Player-${blackPlayer.socketId.substring(0, 5)}`,
      isGuest: blackPlayer.isGuest === false ? false : true,
      gamesPlayed: blackPlayer.gamesPlayed || 0,
      connected: true
    };

    // Create the active game in GameManagerService
    const newGame = this.gameManagerService.createGame(
      gameId,
      whiteGamePlayer,
      blackGamePlayer,
      player1.gameMode,
      player1.timeControl,
      player1.rated
    );

    // Store the database UUID in the game state
    newGame.dbGameId = dbGameId;

    // Handle bet challenge if it exists
    const betChallengeId = whitePlayer.betChallengeId || blackPlayer.betChallengeId;
    if (betChallengeId) {
      try {
        // Link the bet challenge to the game
        const success = await this.betService.linkBetToGame(betChallengeId, gameId);
        if (success) {
          this.logger.log(`Linked bet challenge ${betChallengeId} to game ${gameId}`);
        } else {
          this.logger.warn(`Failed to link bet challenge ${betChallengeId} to game ${gameId}`);
        }
      } catch (error) {
        this.logger.error(`Error linking bet challenge to game: ${error.message}`, error.stack);
      }
    }

    // Create a database record if at least one player is registered
    const bothPlayersAreRegistered = !whitePlayer.isGuest && !blackPlayer.isGuest && whitePlayerId && blackPlayerId;
    const atLeastOnePlayerIsRegistered = (!whitePlayer.isGuest && whitePlayerId) || (!blackPlayer.isGuest && blackPlayerId);
    
    // Determine whether to save the game based on your business logic
    // Here we're choosing to save if at least one player is registered
    if (atLeastOnePlayerIsRegistered) {
      try {
        // Create a new game record with valid UUIDs
        const gameData = {
          id: dbGameId,  // This is our UUID for the database
          customId: gameId, // Store the custom game ID for frontend reference
          // Use the player UUIDs if they exist, otherwise use undefined
          whitePlayerId: whitePlayerId || undefined,
          blackPlayerId: blackPlayerId || undefined,
          status: 'ongoing' as 'ongoing' | 'white_win' | 'black_win' | 'draw' | 'aborted',
          rated: player1.rated,
          whitePlayerRating: whitePlayer.rating,
          blackPlayerRating: blackPlayer.rating,
          timeControl: player1.timeControl,
        };

        const savedGame = await this.gameRepositoryService.create(gameData);
        this.logger.log(`Created database record for game ${gameId} with UUID ${dbGameId} - Game DB record ID: ${savedGame.id}`);
        
        if (bothPlayersAreRegistered) {
          this.logger.log(`Both players are registered users - Game will be rated: ${player1.rated}`);
        } else {
          this.logger.log(`At least one player is a guest - Game will NOT affect ratings regardless of 'rated' setting`);
        }
      } catch (error) {
        this.logger.error(`Error creating game record: ${error.message}`, error.stack);
      }
    } else {
      this.logger.log(`Skipping database record creation for game ${gameId} with UUID ${dbGameId} because both players are guests`);
    }

    // Emit events to clients
    this.notifyPlayersAboutMatch(
      whitePlayer,
      blackPlayer,
      whitePlayerSocketId,
      blackPlayerSocketId,
      gameId
    );
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
    const avgRatingDifference = similarPlayersCount > 0 
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
    
    return players.findIndex(p => p.socketId === player.socketId) + 1;
  }

  private assignPlayerColors(player1: Player, player2: Player) {
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
      this.logger.log(`Case 1: Player1 chose White, Player2 chose Black - assigned accordingly`);
    }
    else if (player1SidePreference === 'black' && player2SidePreference === 'white') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`Case 1: Player1 chose Black, Player2 chose White - assigned accordingly`);
    }
    // CASE 2: One chooses White/Black, other chooses Random
    else if (player1SidePreference === 'white' && player2SidePreference === 'random') {
      player1Color = 'white';
      player2Color = 'black';
      this.logger.log(`Case 2: Player1 chose White, Player2 chose Random - assigned accordingly`);
    }
    else if (player1SidePreference === 'black' && player2SidePreference === 'random') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`Case 2: Player1 chose Black, Player2 chose Random - assigned accordingly`);
    }
    else if (player1SidePreference === 'random' && player2SidePreference === 'white') {
      player1Color = 'black';
      player2Color = 'white';
      this.logger.log(`Case 2: Player1 chose Random, Player2 chose White - assigned accordingly`);
    }
    else if (player1SidePreference === 'random' && player2SidePreference === 'black') {
      player1Color = 'white';
      player2Color = 'black';
      this.logger.log(`Case 2: Player1 chose Random, Player2 chose Black - assigned accordingly`);
    }
    // CASE 3: Both choose Random - assign randomly
    else if (player1SidePreference === 'random' && player2SidePreference === 'random') {
      // Use timestamp for randomness
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Case 3: Both chose Random - Player1 gets ${player1Color}`);
    }
    // CASE 4: Both choose same side (White or Black) - randomly assign
    else if (player1SidePreference === 'white' && player2SidePreference === 'white') {
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Case 4: Both chose White - Player1 gets ${player1Color}`);
    }
    else if (player1SidePreference === 'black' && player2SidePreference === 'black') {
      const player1GetsBlack = Math.random() > 0.5;
      player1Color = player1GetsBlack ? 'black' : 'white';
      player2Color = player1GetsBlack ? 'white' : 'black';
      this.logger.log(`Case 4: Both chose Black - Player1 gets ${player1Color}`);
    }
    // Fallback
    else {
      const player1GetsWhite = Math.random() > 0.5;
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Fallback case - Player1 gets ${player1Color}`);
    }
    
    // Get the correct player objects based on assigned colors
    const whitePlayer = player1Color === 'white' ? player1 : player2;
    const blackPlayer = player1Color === 'white' ? player2 : player1;
    
    return {
      whitePlayer,
      blackPlayer,
      whitePlayerSocketId: whitePlayer.socketId,
      blackPlayerSocketId: blackPlayer.socketId
    };
  }

  private notifyPlayersAboutMatch(
    whitePlayer: Player,
    blackPlayer: Player,
    whitePlayerSocketId: string,
    blackPlayerSocketId: string,
    gameId: string
  ): void {
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
        username: whitePlayer.username || `Player-${whitePlayerSocketId.substring(0, 5)}`
      },
      blackPlayer: {
        socketId: blackPlayerSocketId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayerSocketId.substring(0, 5)}`
      }
    };
    
    this.logger.log(`Match created: ${gameId} between ${whitePlayer.socketId} (white) and ${blackPlayer.socketId} (black)`);
    
    // Send match data to white player
    whitePlayer.socket.emit('matchFound', { 
      ...gameData,
      playerColor: 'white',
      opponentColor: 'black'
    });
    
    // Send match data to black player
    blackPlayer.socket.emit('matchFound', { 
      ...gameData,
      playerColor: 'black',
      opponentColor: 'white'
    });
    
    // Join both players to a game room for further communication
    whitePlayer.socket.join(gameId);
    blackPlayer.socket.join(gameId);
  }
} 