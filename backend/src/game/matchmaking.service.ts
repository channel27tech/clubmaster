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
    
    // Determine which player plays white based on preferences
    let isPlayer1White = Math.random() < 0.5; // Default random assignment
    
    // Check player preferences
    if (player1.preferredSide === 'white' && player2.preferredSide === 'white') {
      // Both want white, randomly choose
      isPlayer1White = Math.random() < 0.5;
    } else if (player1.preferredSide === 'black' && player2.preferredSide === 'black') {
      // Both want black, randomly choose
      isPlayer1White = Math.random() < 0.5;
    } else if (player1.preferredSide === 'white' && player2.preferredSide !== 'white') {
      // Player 1 wants white, player 2 doesn't specifically want white
      isPlayer1White = true;
    } else if (player1.preferredSide !== 'black' && player2.preferredSide === 'black') {
      // Player 2 wants black, player 1 doesn't specifically want black
      isPlayer1White = true;
    } else if (player1.preferredSide === 'black' && player2.preferredSide !== 'black') {
      // Player 1 wants black, player 2 doesn't specifically want black
      isPlayer1White = false;
    } else if (player1.preferredSide !== 'white' && player2.preferredSide === 'white') {
      // Player 2 wants white, player 1 doesn't specifically want white
      isPlayer1White = false;
    }
    
    const whitePlayer = isPlayer1White ? player1 : player2;
    const blackPlayer = isPlayer1White ? player2 : player1;
    
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
    
    const gameData = {
      gameId,
      gameMode: player1.gameMode,
      timeControl: player1.timeControl,
      rated: player1.rated,
      whitePlayer: {
        socketId: whitePlayer.socketId,
        rating: whitePlayer.rating,
      },
      blackPlayer: {
        socketId: blackPlayer.socketId,
        rating: blackPlayer.rating,
      },
      created: new Date(),
    };
    
    this.logger.log(`Match created: ${gameId} between ${player1.socketId} and ${player2.socketId}`);
    this.logger.log(`Game registered: ${gameId}`);
    
    // Notify both players that a match has been found
    player1.socket.emit('matchFound', { ...gameData, playerColor: isPlayer1White ? 'white' : 'black' });
    player2.socket.emit('matchFound', { ...gameData, playerColor: isPlayer1White ? 'black' : 'white' });
    
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