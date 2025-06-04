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
    isGuest: boolean = true,    // Whether the player is a guest
    betChallengeId?: string     // ID of associated bet challenge
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
      gamesPlayed: 0,
      betChallengeId: betChallengeId // Store bet challenge ID if provided
    });
    
    // Log additional info if bet challenge is present
    if (betChallengeId) {
      this.logger.log(`Player ${socketId} added to matchmaking queue with bet challenge ${betChallengeId}`);
    } else {
      this.logger.log(
        `Player ${socketId}${userId ? ` (User: ${userId})` : ' (Guest)'} added to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`
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
    try {
      // Get player colors based on preferences
      const { whitePlayer, blackPlayer, whitePlayerSocketId, blackPlayerSocketId } = this.assignPlayerColors(player1, player2);

      // Check if this is a bet game
      const betChallengeId = player1.betChallengeId || player2.betChallengeId;
      if (betChallengeId) {
        this.logger.log(`Creating match for bet challenge: ${betChallengeId}`);
      }

      // Generate a unique game ID
      const gameId = uuidv4();
      
      // Create white player object
      const whiteGamePlayer = {
        socketId: whitePlayerSocketId,
        userId: whitePlayer.userId,
        rating: whitePlayer.rating,
        username: whitePlayer.username || `Player-${whitePlayerSocketId.substring(0, 5)}`,
        isGuest: whitePlayer.isGuest || true,
        connected: true,
        gamesPlayed: whitePlayer.gamesPlayed || 0
      };
      
      // Create black player object
      const blackGamePlayer = {
        socketId: blackPlayerSocketId,
        userId: blackPlayer.userId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayerSocketId.substring(0, 5)}`,
        isGuest: blackPlayer.isGuest || true,
        connected: true,
        gamesPlayed: blackPlayer.gamesPlayed || 0
      };
      
      // Create a new game with proper parameters
      const gameState = this.gameManagerService.createGame(
        gameId,
        whiteGamePlayer,
        blackGamePlayer,
        whitePlayer.gameMode || 'Rapid',
        whitePlayer.timeControl || '10+0',
        whitePlayer.rated !== undefined ? whitePlayer.rated : true
      );

      if (!gameState) {
        this.logger.error('Failed to create game');
        return;
      }

      // Handle bet challenge if it exists
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
      } else {
        // Check for bet challenges between these players
        this.checkAndLinkBetChallenge(whitePlayer.userId, blackPlayer.userId, gameId);
      }

      // Remove players from the queue
      this.removePlayerFromQueue(whitePlayer.socketId);
      this.removePlayerFromQueue(blackPlayer.socketId);

      // Notify players about the match
      this.notifyPlayersAboutMatch(whitePlayer, blackPlayer, whitePlayerSocketId, blackPlayerSocketId, gameId);
    } catch (error) {
      this.logger.error(`Error creating match: ${error.message}`, error.stack);
      
      // Notify players of the error
      player1.socket.emit('matchmakingError', { message: 'Failed to create game. Please try again.' });
      player2.socket.emit('matchmakingError', { message: 'Failed to create game. Please try again.' });
    }
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
        username: whitePlayer.username || `Player-${whitePlayerSocketId.substring(0, 5)}`
      },
      blackPlayer: {
        socketId: blackPlayerSocketId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayerSocketId.substring(0, 5)}`
      },
      // Add bet challenge ID if it exists
      ...(betChallengeId && { betChallengeId })
    };
    
    this.logger.log(`Match created: ${gameId} between ${whitePlayer.socketId} (white) and ${blackPlayer.socketId} (black)`);
    
    // Log if this is a bet game
    if (betChallengeId) {
      this.logger.log(`This is a bet game with bet challenge ID: ${betChallengeId}`);
    }
    
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

  /**
   * Check if there's a bet challenge between two players and link it to the game
   * @param whitePlayerId User ID of the white player
   * @param blackPlayerId User ID of the black player
   * @param gameId Game ID to link the bet to
   */
  private async checkAndLinkBetChallenge(
    whitePlayerId: string | undefined,
    blackPlayerId: string | undefined,
    gameId: string
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
      const betChallenge = [...whitePlayerChallenges, ...blackPlayerChallenges].find(challenge => 
        challenge.status === 'accepted' && 
        ((challenge.challengerId === whitePlayerId && challenge.opponentId === blackPlayerId) || 
         (challenge.challengerId === blackPlayerId && challenge.opponentId === whitePlayerId))
      );
      
      if (betChallenge) {
        this.logger.log(`Found bet challenge ${betChallenge.id} between players, linking to game ${gameId}`);
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
      this.logger.warn(`Not enough players in queue to match for bet challenge: ${betChallengeId}. Queue size: ${this.matchmakingQueue.size}`);
      // Log all players in queue for debugging
      const allPlayers = Array.from(this.matchmakingQueue.values());
      this.logger.log(`Current queue contains: ${allPlayers.map(p => `${p.socketId} (${p.userId || 'no-id'}${p.betChallengeId ? `, bet: ${p.betChallengeId}` : ''})`)}`);
      return;
    }
    
    // Find players with this bet challenge ID
    const players = Array.from(this.matchmakingQueue.values());
    const betPlayers = players.filter(player => player.betChallengeId === betChallengeId);
    
    this.logger.log(`Found ${betPlayers.length} players with bet challenge ID: ${betChallengeId}`);
    
    if (betPlayers.length < 2) {
      this.logger.warn(`Could not find 2 players with bet challenge ID: ${betChallengeId}, found: ${betPlayers.length}`);
      
      // Log detailed info about all players in queue for debugging
      players.forEach((player, index) => {
        this.logger.log(`Player ${index + 1} in queue: socketId=${player.socketId}, userId=${player.userId || 'none'}, betChallengeId=${player.betChallengeId || 'none'}`);
      });
      
      return;
    }
    
    if (betPlayers.length > 2) {
      this.logger.warn(`Found more than 2 players with bet challenge ID: ${betChallengeId}, using first 2`);
    }
    
    // Get the first 2 players
    const player1 = betPlayers[0];
    const player2 = betPlayers[1];
    
    this.logger.log(`Creating match for bet challenge ${betChallengeId} between players: ${player1.socketId} (${player1.userId || 'no-id'}) and ${player2.socketId} (${player2.userId || 'no-id'})`);
    
    // Create a match between these two players
    this.createMatch(player1, player2).catch(error => {
      this.logger.error(`Error creating match for bet challenge ${betChallengeId}: ${error.message}`, error.stack);
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
    betChallengeId?: string
  ): void {
    this.logger.log(`Adding player ${userId} to matchmaking queue without socket (bet challenge: ${betChallengeId || 'none'})`);
    
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
            this.logger.log(`Virtual socket ${virtualSocketId} in room ${room} would emit ${event}`);
            return true;
          }
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
    this.logger.log(`Added virtual player ${virtualSocketId} (${userId}) to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`);
    
    // If this is a bet challenge, immediately try to process matchmaking
    if (betChallengeId) {
      setTimeout(() => {
        this.logger.log(`Triggering immediate matchmaking check for virtual player with bet challenge ${betChallengeId}`);
        this.processMatchmakingForBetChallenge(betChallengeId);
      }, 500);
    }
  }
} 