import { Injectable, Logger } from '@nestjs/common';

// Result types for rating calculation
export enum RatingResult {
  WIN = 1,
  DRAW = 0.5,
  LOSS = 0,
}

// Rating change result interface
export interface RatingChange {
  newRating: number;
  ratingChange: number;
}

@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  
  // K-factor determines the maximum possible adjustment per game
  // For established players, K=20 is common; for newer players, K=40 is used
  private readonly K_FACTOR_DEFAULT = 20;
  private readonly K_FACTOR_NEW_PLAYER = 40;
  private readonly NEW_PLAYER_GAMES_THRESHOLD = 30;
  
  // Default rating for new players
  private readonly DEFAULT_RATING = 1500;

  /**
   * Calculate rating changes for a player
   * Uses the ELO rating system formula
   * 
   * @param playerRating Current rating of the player
   * @param opponentRating Rating of the opponent
   * @param result Outcome of the game (win, loss, draw)
   * @param playerGamesCount Number of games played by the player
   * @returns New rating and rating change for the player
   */
  calculateRatingChange(
    playerRating: number,
    opponentRating: number,
    result: RatingResult,
    playerGamesCount = 0,
  ): RatingChange {
    // If this is a new player or guest, use default rating
    if (!playerRating) {
      playerRating = this.DEFAULT_RATING;
    }

    // Calculate expected score based on ELO formula
    const expectedScore = this.calculateExpectedScore(playerRating, opponentRating);
    
    // Determine K-factor based on player's experience
    const kFactor = playerGamesCount < this.NEW_PLAYER_GAMES_THRESHOLD
      ? this.K_FACTOR_NEW_PLAYER
      : this.K_FACTOR_DEFAULT;
    
    // Calculate new rating using the ELO formula
    const ratingChange = Math.round(kFactor * (result - expectedScore));
    const newRating = playerRating + ratingChange;
    
    this.logger.debug(
      `Rating calculation: ${playerRating} -> ${newRating} (${ratingChange > 0 ? '+' : ''}${ratingChange})`,
    );
    
    return {
      newRating,
      ratingChange,
    };
  }

  /**
   * Calculate expected score based on ELO formula
   * Expected score represents the probability of winning
   * 
   * @param playerRating 
   * @param opponentRating 
   * @returns Expected score (between 0 and 1)
   */
  private calculateExpectedScore(playerRating: number, opponentRating: number): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }
  
  /**
   * Calculate rating changes for both players in a game
   * 
   * @param whiteRating Rating of the white player
   * @param blackRating Rating of the black player
   * @param whiteResult Result for the white player (WIN, DRAW, LOSS)
   * @param whiteGamesCount Number of games played by white player
   * @param blackGamesCount Number of games played by black player
   * @returns Rating changes for both players
   */
  calculateGameRatingChanges(
    whiteRating: number,
    blackRating: number,
    whiteResult: RatingResult,
    whiteGamesCount = 0,
    blackGamesCount = 0,
  ): { white: RatingChange; black: RatingChange } {
    // Calculate white's rating change
    const whiteChange = this.calculateRatingChange(
      whiteRating,
      blackRating,
      whiteResult,
      whiteGamesCount,
    );
    
    // Black's result is the opposite of white's
    const blackResult = whiteResult === RatingResult.WIN
      ? RatingResult.LOSS
      : whiteResult === RatingResult.LOSS
        ? RatingResult.WIN
        : RatingResult.DRAW;
    
    // Calculate black's rating change
    const blackChange = this.calculateRatingChange(
      blackRating,
      whiteRating,
      blackResult,
      blackGamesCount,
    );
    
    return {
      white: whiteChange,
      black: blackChange,
    };
  }
} 