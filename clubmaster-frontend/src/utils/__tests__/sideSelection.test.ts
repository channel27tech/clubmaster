import { determineSides, deterministicRandom, SidePreference } from '../sideSelection';

describe('Side Selection Logic', () => {
  // Test the deterministic random function
  describe('deterministicRandom', () => {
    it('returns consistent results for the same gameId', () => {
      const gameId = 'test-game-123';
      const result1 = deterministicRandom(gameId);
      const result2 = deterministicRandom(gameId);
      expect(result1).toBe(result2);
    });
    
    it('can return different results for different gameIds', () => {
      // This test might occasionally fail due to hash collisions, but it's unlikely
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(deterministicRandom(`game-${i}`));
      }
      // We should have at least 2 different results in 10 tries
      expect(results.size).toBeGreaterThan(1);
    });
  });
  
  // Test the side selection logic
  describe('determineSides', () => {
    // Case 1: One player selects White and the other Black
    it('assigns White to player1 when player1 chooses White and player2 chooses Black', () => {
      const preferences = {
        player1Side: 'white' as SidePreference,
        player2Side: 'black' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'white', player2Color: 'black' });
    });
    
    it('assigns Black to player1 when player1 chooses Black and player2 chooses White', () => {
      const preferences = {
        player1Side: 'black' as SidePreference,
        player2Side: 'white' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'black', player2Color: 'white' });
    });
    
    // Case 2: One player selects a specific color and the other selects Random
    it('assigns White to player1 when player1 chooses White and player2 chooses Random', () => {
      const preferences = {
        player1Side: 'white' as SidePreference,
        player2Side: 'random' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'white', player2Color: 'black' });
    });
    
    it('assigns Black to player1 when player1 chooses Black and player2 chooses Random', () => {
      const preferences = {
        player1Side: 'black' as SidePreference,
        player2Side: 'random' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'black', player2Color: 'white' });
    });
    
    it('assigns Black to player1 when player1 chooses Random and player2 chooses White', () => {
      const preferences = {
        player1Side: 'random' as SidePreference,
        player2Side: 'white' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'black', player2Color: 'white' });
    });
    
    it('assigns White to player1 when player1 chooses Random and player2 chooses Black', () => {
      const preferences = {
        player1Side: 'random' as SidePreference,
        player2Side: 'black' as SidePreference
      };
      
      const result = determineSides(preferences, 'game-id');
      expect(result).toEqual({ player1Color: 'white', player2Color: 'black' });
    });
    
    // Case 3: Both players select the same side
    it('randomly assigns colors when both players choose White', () => {
      const preferences = {
        player1Side: 'white' as SidePreference,
        player2Side: 'white' as SidePreference
      };
      
      // Mock the deterministicRandom function to return true
      const originalRandom = deterministicRandom;
      global.deterministicRandom = jest.fn().mockReturnValue(true);
      
      const result1 = determineSides(preferences, 'game-id');
      expect(result1).toEqual({ player1Color: 'white', player2Color: 'black' });
      
      // Mock to return false
      (global.deterministicRandom as jest.Mock).mockReturnValue(false);
      
      const result2 = determineSides(preferences, 'game-id');
      expect(result2).toEqual({ player1Color: 'black', player2Color: 'white' });
      
      // Restore original function
      global.deterministicRandom = originalRandom;
    });
    
    it('randomly assigns colors when both players choose Black', () => {
      const preferences = {
        player1Side: 'black' as SidePreference,
        player2Side: 'black' as SidePreference
      };
      
      // Mock the deterministicRandom function to return true
      const originalRandom = deterministicRandom;
      global.deterministicRandom = jest.fn().mockReturnValue(true);
      
      const result1 = determineSides(preferences, 'game-id');
      expect(result1).toEqual({ player1Color: 'black', player2Color: 'white' });
      
      // Mock to return false
      (global.deterministicRandom as jest.Mock).mockReturnValue(false);
      
      const result2 = determineSides(preferences, 'game-id');
      expect(result2).toEqual({ player1Color: 'white', player2Color: 'black' });
      
      // Restore original function
      global.deterministicRandom = originalRandom;
    });
    
    // Case 4: Both players select Random
    it('randomly assigns colors when both players choose Random', () => {
      const preferences = {
        player1Side: 'random' as SidePreference,
        player2Side: 'random' as SidePreference
      };
      
      // Mock the deterministicRandom function to return true
      const originalRandom = deterministicRandom;
      global.deterministicRandom = jest.fn().mockReturnValue(true);
      
      const result1 = determineSides(preferences, 'game-id');
      expect(result1).toEqual({ player1Color: 'white', player2Color: 'black' });
      
      // Mock to return false
      (global.deterministicRandom as jest.Mock).mockReturnValue(false);
      
      const result2 = determineSides(preferences, 'game-id');
      expect(result2).toEqual({ player1Color: 'black', player2Color: 'white' });
      
      // Restore original function
      global.deterministicRandom = originalRandom;
    });
  });
}); 