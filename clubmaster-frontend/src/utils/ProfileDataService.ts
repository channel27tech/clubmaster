import { format } from 'date-fns';

/**
 * User profile data interface
 */
export interface UserProfile {
  id: string;
  displayName: string;
  photoURL: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
}

/**
 * Game history entry interface from backend API
 */
export interface GameHistoryEntry {
  id: string;
  gameId: string;
  opponent: {
    id: string;
    name: string;
  };
  opponentId: string;
  opponentName: string;
  opponentRating: number;
  result: string;
  endReason: string | null;
  resultReason: string | null;
  timeControl: string;
  moveCount: number;
  date: string;
  status: string;
  userColor: 'white' | 'black';
  rated: boolean;
  whitePlayerRating: number;
  blackPlayerRating: number;
  whitePlayerRatingAfter: number | null;
  blackPlayerRatingAfter: number | null;
  winnerId: string | null;
  userId: string;
}

/**
 * Time control category
 */
export type TimeControlCategory = 'Bullet' | 'Blitz' | 'Rapid';

/**
 * Formatted game history entry interface
 */
export interface FormattedGameEntry {
  id: string;
  date: string;
  opponent: string;
  opponentId: string;
  opponentRating: number;
  result: string;
  resultIcon: string;
  resultColor: string;
  timeControl: string;
  timeControlCategory: TimeControlCategory;
  moveCount: string;
  status: string;
  userColor: 'white' | 'black';
  rated: boolean;
  formattedText: string;
  ratingInfo: {
    userRatingBefore: number;
    userRatingAfter: number | null;
    opponentRatingBefore: number;
    opponentRatingAfter: number | null;
  };
}

/**
 * Service for fetching and formatting profile data
 */
export class ProfileDataService {
  private baseUrl: string;

  constructor() {
    // Use environment variable for API URL or default to localhost
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Fetch user profile data
   * @param userId Firebase User ID to fetch profile for
   * @returns User profile data or default values if not found
   */
  async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log(`Fetching profile data for Firebase UID: ${userId}`);
      const response = await fetch(`${this.baseUrl}/profile/${userId}`);
      
      if (response.status === 404) {
        console.warn(`User not found for Firebase UID: ${userId}`);
        // Return default values when user not found
        return {
          id: userId,
          displayName: 'Chess Player',
          photoURL: '/images/dp 1.svg',
          rating: 1500,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDraw: 0
        };
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`);
      }
      
      const data = await response.json() as UserProfile;
      console.log('Profile data fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Return default values on error
      return {
        id: userId,
        displayName: 'Chess Player',
        photoURL: '/images/dp 1.svg',
        rating: 1500,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDraw: 0
      };
    }
  }

  /**
   * Fetch user's game history
   * @param userId Firebase User ID to fetch game history for
   * @returns Game history data or empty array if not found
   */
  async fetchGameHistory(userId: string): Promise<GameHistoryEntry[]> {
    try {
      console.log(`Fetching game history for Firebase UID: ${userId}`);
      const response = await fetch(`${this.baseUrl}/profile/${userId}/games`);
      
      if (response.status === 404) {
        console.warn(`User not found for Firebase UID: ${userId}, returning empty game history`);
        return [];
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch game history: ${response.statusText}`);
      }
      
      const data = await response.json() as GameHistoryEntry[];
      console.log('Game history fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('Error fetching game history:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Determine the time control category based on base time in minutes
   * @param timeControl Time control string (e.g., "10+0")
   * @returns Time control category (Bullet, Blitz, or Rapid)
   */
  private getTimeControlCategory(timeControl: string): TimeControlCategory {
    // Parse the base time from the time control string (e.g., "10+0" -> 10)
    const baseTimeMinutes = parseInt(timeControl.split('+')[0], 10);
    
    if (baseTimeMinutes >= 10) {
      return 'Rapid';
    } else if (baseTimeMinutes >= 3) {
      return 'Blitz';
    } else {
      return 'Bullet';
    }
  }

  /**
   * Format game history for display with new requirements
   * @param games Array of game history entries
   * @returns Formatted game history entries
   */
  formatGameHistory(games: GameHistoryEntry[]): FormattedGameEntry[] {
    return games.map(game => {
      // Format the date
      const gameDate = format(new Date(game.date), 'MMM dd, yyyy');
      
      // Determine time control category
      const timeControlCategory = this.getTimeControlCategory(game.timeControl);
      
      // Determine result and icon
      let resultText = game.result;
      let resultIcon = '';
      let resultColor = '';
      
      if (game.status === 'ongoing') {
        resultText = 'Ongoing';
        resultIcon = '';
        resultColor = 'neutral';
      } else if (game.status === 'aborted') {
        resultText = 'Aborted';
        resultIcon = '';
        resultColor = 'neutral';
      } else if (game.status === 'draw') {
        resultText = 'Draw';
        resultIcon = '= ';
        resultColor = 'neutral';
      } else if (
        (game.status === 'white_win' && game.userColor === 'white') ||
        (game.status === 'black_win' && game.userColor === 'black')
      ) {
        resultText = 'Win';
        resultIcon = '+ ';
        resultColor = 'green';
      } else {
        resultText = 'Loss';
        resultIcon = '- ';
        resultColor = 'red';
      }
      
      // Add reason if available
      if (game.resultReason && resultText !== 'Ongoing' && resultText !== 'Aborted') {
        resultText += ` by ${game.resultReason}`;
      }
      
      // Format move count with proper pluralization
      const moveText = game.moveCount === 1 ? '1 move' : `${game.moveCount} moves`;
      
      // Format according to new requirements
      const formattedText = `${timeControlCategory} | vs ${game.opponentName} (${game.opponentRating}) | ${resultIcon}${resultText}`;
      
      return {
        id: game.id,
        date: gameDate,
        opponent: game.opponentName,
        opponentId: game.opponentId,
        opponentRating: game.opponentRating,
        result: resultText,
        resultIcon,
        resultColor,
        timeControl: game.timeControl,
        timeControlCategory,
        moveCount: moveText,
        status: game.status,
        userColor: game.userColor,
        rated: game.rated,
        formattedText,
        ratingInfo: {
          userRatingBefore: game.userColor === 'white' ? game.whitePlayerRating : game.blackPlayerRating,
          userRatingAfter: game.userColor === 'white' ? game.whitePlayerRatingAfter : game.blackPlayerRatingAfter,
          opponentRatingBefore: game.userColor === 'white' ? game.blackPlayerRating : game.whitePlayerRating,
          opponentRatingAfter: game.userColor === 'white' ? game.blackPlayerRatingAfter : game.whitePlayerRatingAfter,
        }
      };
    });
  }
}

// Create singleton instance
const profileDataService = new ProfileDataService();
export default profileDataService;
