import { Test, TestingModule } from '@nestjs/testing';
import { RatingService, RatingResult } from '../src/game/rating/rating.service';

describe('RatingService', () => {
  let service: RatingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RatingService],
    }).compile();

    service = module.get<RatingService>(RatingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateRatingChange', () => {
    it('should correctly calculate rating increase for a win against a weaker opponent', () => {
      const result = service.calculateRatingChange(
        1800, // Player rating
        1600, // Opponent rating
        RatingResult.WIN, // Player won
        100 // Player has 100 games
      );
      
      // Expected result: A small rating increase because player was expected to win
      expect(result.ratingChange).toBeGreaterThan(0);
      expect(result.ratingChange).toBeLessThan(10); // Small change since player was expected to win
      expect(result.newRating).toBeGreaterThan(1800);
    });

    it('should correctly calculate rating increase for a win against a stronger opponent', () => {
      const result = service.calculateRatingChange(
        1600, // Player rating
        1800, // Opponent rating
        RatingResult.WIN, // Player won
        100 // Player has 100 games
      );
      
      // Expected result: A larger rating increase because player was not expected to win
      expect(result.ratingChange).toBeGreaterThan(0);
      expect(result.ratingChange).toBeGreaterThan(10); // Larger change since player was not expected to win
      expect(result.newRating).toBeGreaterThan(1600);
    });

    it('should correctly calculate rating decrease for a loss against a weaker opponent', () => {
      const result = service.calculateRatingChange(
        1800, // Player rating
        1600, // Opponent rating
        RatingResult.LOSS, // Player lost
        100 // Player has 100 games
      );
      
      // Expected result: A larger rating decrease because player was expected to win
      expect(result.ratingChange).toBeLessThan(0);
      expect(result.ratingChange).toBeLessThan(-10); // Larger negative change since player was expected to win
      expect(result.newRating).toBeLessThan(1800);
    });

    it('should correctly calculate rating change for a draw with equal opponents', () => {
      const result = service.calculateRatingChange(
        1700, // Player rating
        1700, // Opponent rating
        RatingResult.DRAW, // Game was a draw
        100 // Player has 100 games
      );
      
      // Expected result: Minimal or no rating change since draw is the expected outcome
      expect(result.ratingChange).toBeCloseTo(0, 0); // Close to 0 (might be slightly off due to rounding)
      expect(result.newRating).toBeCloseTo(1700, 0);
    });

    it('should use a higher K-factor for new players', () => {
      const experiencedPlayerResult = service.calculateRatingChange(
        1500, // Player rating
        1700, // Opponent rating
        RatingResult.WIN, // Player won
        100 // Experienced player (> 30 games)
      );
      
      const newPlayerResult = service.calculateRatingChange(
        1500, // Player rating
        1700, // Opponent rating
        RatingResult.WIN, // Player won
        10 // New player (< 30 games)
      );
      
      // Expected result: New player should gain more rating than experienced player for the same win
      expect(newPlayerResult.ratingChange).toBeGreaterThan(experiencedPlayerResult.ratingChange);
    });
  });

  describe('calculateGameRatingChanges', () => {
    it('should calculate opposite rating changes for both players', () => {
      const changes = service.calculateGameRatingChanges(
        1700, // White rating
        1700, // Black rating
        RatingResult.WIN, // White won
        100, // White games
        100 // Black games
      );
      
      // Expected: Positive change for white, negative change for black, and the absolute values should be equal
      expect(changes.white.ratingChange).toBeGreaterThan(0);
      expect(changes.black.ratingChange).toBeLessThan(0);
      expect(Math.abs(changes.white.ratingChange)).toBe(Math.abs(changes.black.ratingChange));
      
      expect(changes.white.newRating).toBe(1700 + changes.white.ratingChange);
      expect(changes.black.newRating).toBe(1700 + changes.black.ratingChange);
    });

    it('should calculate draw changes correctly', () => {
      const changes = service.calculateGameRatingChanges(
        1800, // White rating
        1600, // Black rating
        RatingResult.DRAW, // Draw
        100, // White games
        100 // Black games
      );
      
      // Expected: Negative change for white (was expected to win) and positive change for black
      expect(changes.white.ratingChange).toBeLessThan(0);
      expect(changes.black.ratingChange).toBeGreaterThan(0);
      
      expect(changes.white.newRating).toBe(1800 + changes.white.ratingChange);
      expect(changes.black.newRating).toBe(1600 + changes.black.ratingChange);
    });
  });
}); 