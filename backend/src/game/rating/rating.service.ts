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
  
  // K-factor as per specified requirements
  private readonly K_FACTOR = 32;
  
  // Default rating for new players
  public readonly DEFAULT_RATING = 400;

  /**
   * Calculate rating changes for a player
   * Uses the ELO rating system formula
   * 
   * @param playerRating Current rating of the player
   * @param opponentRating Rating of the opponent
   * @param result Outcome of the game (win, loss, draw)
   * @returns New rating and rating change for the player
   */
  calculateRatingChange(
    playerRating: number,
    opponentRating: number,
    result: RatingResult,
  ): RatingChange {
    // If this is a new player or guest, use default rating
    if (!playerRating) {
      playerRating = this.DEFAULT_RATING;
    }

    // Calculate expected score based on ELO formula
    const expectedScore = this.calculateExpectedScore(playerRating, opponentRating);
    
    // Calculate new rating using the ELO formula with fixed K-factor of 32
    const ratingChange = Math.round(this.K_FACTOR * (result - expectedScore));
    
    // Prevent negative rating as per requirements
    const newRating = Math.max(0, playerRating + ratingChange);
    
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
   * @returns Rating changes for both players
   */
  calculateGameRatingChanges(
    whiteRating: number,
    blackRating: number,
    whiteResult: RatingResult,
  ): { white: RatingChange; black: RatingChange } {
    // Calculate white's rating change
    const whiteChange = this.calculateRatingChange(
      whiteRating,
      blackRating,
      whiteResult,
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
    );
    
    return {
      white: whiteChange,
      black: blackChange,
    };
  }

  /**
   * Calculate ELO rating (public method for use by other services)
   */
  calculateEloRating(playerRating: number, opponentRating: number, result: RatingResult): number {
    const ratingChange = this.calculateRatingChange(playerRating, opponentRating, result);
    return ratingChange.newRating;
  }

  /**
   * Calculate new ratings for both players based on result
   * 
   * @param whiteRating White player's current rating
   * @param blackRating Black player's current rating
   * @param result The game result ('white_wins', 'black_wins', or 'draw')
   * @returns New ratings for both players
   */
  calculateNewRatings(
    whiteRating: number,
    blackRating: number,
    result: 'white_wins' | 'black_wins' | 'draw'
  ): { whiteNewRating: number, blackNewRating: number } {
    // Map the string result to RatingResult enum
    let whiteResult: RatingResult;
    
    switch (result) {
      case 'white_wins':
        whiteResult = RatingResult.WIN;
        break;
      case 'black_wins':
        whiteResult = RatingResult.LOSS;
        break;
      case 'draw':
        whiteResult = RatingResult.DRAW;
        break;
      default:
        // This shouldn't happen with strict typing, but handle it anyway
        whiteResult = RatingResult.DRAW;
    }
    
    // Calculate rating changes using existing method
    const ratingChanges = this.calculateGameRatingChanges(
      whiteRating,
      blackRating,
      whiteResult
    );
    
    return {
      whiteNewRating: ratingChanges.white.newRating,
      blackNewRating: ratingChanges.black.newRating
    };
  }
} 