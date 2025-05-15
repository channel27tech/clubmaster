import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { GameManagerService } from './game-manager.service';

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
  private matchmakingIntervalId: NodeJS.Timeout | null = null;
  private readonly MATCHMAKING_INTERVAL = 2000; // Check for matches every 2 seconds
  private readonly MATCH_RATING_DIFFERENCE = 200; // Maximum rating difference for matching players

  constructor(
    private readonly gameManagerService: GameManagerService,
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
    playerRating: number = 1500 // Default rating for new players
  ): void {
    const socketId = socket.id;
    
    // Check if player is already in queue
    if (this.matchmakingQueue.has(socketId)) {
      this.logger.log(`Player ${socketId} is already in the matchmaking queue`);
      return;
    }
    
    // Add player to queue
    this.matchmakingQueue.set(socketId, {
      socketId,
      rating: playerRating,
      socket,
      gameMode: options.gameMode || 'Blitz',
      timeControl: options.timeControl || '5+0',
      rated: options.rated !== undefined ? options.rated : true,
      preferredSide: options.preferredSide || 'random',
      joinedAt: new Date(),
    });
    
    this.logger.log(`Player ${socketId} added to matchmaking queue. Queue size: ${this.matchmakingQueue.size}`);
    
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
  removePlayerFromQueue(socketId: string): void {
    if (this.matchmakingQueue.has(socketId)) {
      this.matchmakingQueue.delete(socketId);
      this.logger.log(`Player ${socketId} removed from matchmaking queue. Queue size: ${this.matchmakingQueue.size}`);
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
  private createMatch(player1: Player, player2: Player): void {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
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
    // CASE 3: Both choose Random - assign randomly but deterministically
    else if (player1SidePreference === 'random' && player2SidePreference === 'random') {
      // Use gameId for deterministic randomness
      const deterministicRandom = (id: string): boolean => {
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }
        // Even hash means player1 gets white, odd hash means player1 gets black
        return (Math.abs(hash) % 2) === 0;
      };
      
      const player1GetsWhite = deterministicRandom(gameId);
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Case 3: Both chose Random - Player1 gets ${player1Color}`);
    }
    // CASE 4: Both choose same side (White or Black) - randomly assign one to opposite side
    else if (player1SidePreference === 'white' && player2SidePreference === 'white') {
      const deterministicRandom = (id: string): boolean => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0;
        }
        return (Math.abs(hash) % 2) === 0;
      };
      
      const player1GetsWhite = deterministicRandom(gameId);
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Case 4: Both chose White - Player1 gets ${player1Color}`);
    }
    else if (player1SidePreference === 'black' && player2SidePreference === 'black') {
      const deterministicRandom = (id: string): boolean => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0;
        }
        return (Math.abs(hash) % 2) === 0;
      };
      
      const player1GetsBlack = deterministicRandom(gameId);
      player1Color = player1GetsBlack ? 'black' : 'white';
      player2Color = player1GetsBlack ? 'white' : 'black';
      this.logger.log(`Case 4: Both chose Black - Player1 gets ${player1Color}`);
    }
    // Fallback
    else {
      const deterministicRandom = (id: string): boolean => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0;
        }
        return (Math.abs(hash) % 2) === 0;
      };
      
      const player1GetsWhite = deterministicRandom(gameId);
      player1Color = player1GetsWhite ? 'white' : 'black';
      player2Color = player1GetsWhite ? 'black' : 'white';
      this.logger.log(`Fallback case - Player1 gets ${player1Color}`);
    }
    
    // Verify we've assigned valid colors - safety check
    if (!((player1Color === 'white' && player2Color === 'black') || 
          (player1Color === 'black' && player2Color === 'white'))) {
      this.logger.error(`INVALID COLOR ASSIGNMENT: Player1=${player1Color}, Player2=${player2Color}`);
      // Force a valid assignment as fallback
      player1Color = 'white';
      player2Color = 'black';
    }
    
    // Get the correct player objects based on assigned colors
    const whitePlayer = player1Color === 'white' ? player1 : player2;
    const blackPlayer = player1Color === 'white' ? player2 : player1;
    
    // Create player objects for GameManagerService
    const whiteGamePlayer = {
      socketId: whitePlayer.socketId,
      userId: whitePlayer.userId,
      rating: whitePlayer.rating,
      username: whitePlayer.username || `Player-${whitePlayer.socketId.substring(0, 5)}`,
      isGuest: whitePlayer.isGuest || true,
      gamesPlayed: whitePlayer.gamesPlayed || 0,
      connected: true
    };
    
    const blackGamePlayer = {
      socketId: blackPlayer.socketId,
      userId: blackPlayer.userId,
      rating: blackPlayer.rating,
      username: blackPlayer.username || `Player-${blackPlayer.socketId.substring(0, 5)}`,
      isGuest: blackPlayer.isGuest || true,
      gamesPlayed: blackPlayer.gamesPlayed || 0,
      connected: true
    };
    
    // Register the game with the GameManagerService
    this.gameManagerService.createGame(
      gameId,
      whiteGamePlayer,
      blackGamePlayer, 
      player1.gameMode,
      player1.timeControl,
      player1.rated
    );
    
    // Create the game data object
    const gameData = {
      gameId,
      gameMode: player1.gameMode,
      timeControl: player1.timeControl,
      rated: player1.rated,
      created: new Date(),
      whitePlayer: {
        socketId: whitePlayer.socketId,
        rating: whitePlayer.rating,
        username: whitePlayer.username || `Player-${whitePlayer.socketId.substring(0, 5)}`
      },
      blackPlayer: {
        socketId: blackPlayer.socketId,
        rating: blackPlayer.rating,
        username: blackPlayer.username || `Player-${blackPlayer.socketId.substring(0, 5)}`
      },
      sideAssignment: {
        player1: { 
          socketId: player1.socketId, 
          preferredSide: player1SidePreference,
          assignedColor: player1Color
        },
        player2: { 
          socketId: player2.socketId, 
          preferredSide: player2SidePreference,
          assignedColor: player2Color
        }
      }
    };
    
    this.logger.log(`Match created: ${gameId} between ${player1.socketId} (${player1Color}) and ${player2.socketId} (${player2Color})`);
    
    // Send match data to player1 with clear assigned color
    player1.socket.emit('matchFound', { 
      ...gameData,
      playerColor: player1Color,
      opponentColor: player2Color,
      opponentPreferredSide: player2SidePreference
    });
    
    // Send match data to player2 with clear assigned color
    player2.socket.emit('matchFound', { 
      ...gameData,
      playerColor: player2Color,
      opponentColor: player1Color,
      opponentPreferredSide: player1SidePreference
    });
    
    // Join both players to a game room for further communication
    player1.socket.join(gameId);
    player2.socket.join(gameId);
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
} 