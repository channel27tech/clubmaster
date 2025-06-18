import { auth } from "@/firebase";
import { PlayerData } from '../utils/types';

// Interface for detailed player data with rating changes
export interface PlayerResultData extends PlayerData {
  id: string;
  ratingBefore: number;
  ratingChange: number;
}

// Interface for the complete response from the API
export interface GamePlayersResponse {
  whitePlayer: PlayerData;
  blackPlayer: PlayerData;
}

// Interface for game result data
export interface GameResultResponse {
  gameId: string;
  customId: string;
  status: string;
  resultType: string;
  endReason: string | null;
  whitePlayer: PlayerResultData;
  blackPlayer: PlayerResultData;
  winnerId: string | null;
  rated: boolean;
  timeControl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches player data for a specific game
 * @param gameId The ID of the game to fetch player data for (MUST be the same as received from the server, can be customId or UUID)
 * @returns Promise resolving to player data for white and black players
 */
export async function fetchGamePlayers(gameId: string): Promise<GamePlayersResponse> {
  // Use the full game ID as received - the backend will handle the extraction if needed
  // DO NOT transform or truncate the gameId here!
  console.log('Using full gameId for API call:', gameId);

  // Use the same port as the socket service (3001) instead of trying multiple ports
  const apiUrl = 'http://localhost:3001';
  
  try {
    // Get the current user's token for authentication
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    
    console.log(`Connecting to backend API at ${apiUrl}...`);
    
    // Ensure gameId is properly encoded for URL
    const encodedGameId = encodeURIComponent(gameId);
    
    const response = await fetch(`${apiUrl}/games/${encodedGameId}/players`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // Longer timeout for a single connection attempt
    });

    if (!response.ok) {
      console.error(`API responded with status: ${response.status} ${response.statusText}`);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    // If we get here, we successfully connected
    console.log(`Successfully connected to backend API at ${apiUrl}`);
    const data = await response.json();
    
    // Validate the response data
    if (!data || !data.whitePlayer || !data.blackPlayer) {
      console.error('Invalid player data received:', data);
      throw new Error('Invalid player data format received from server');
    }
    
    // Log the successful data retrieval
    console.log('Player data retrieved successfully:', {
      white: `${data.whitePlayer.username} (${data.whitePlayer.rating})`,
      black: `${data.blackPlayer.username} (${data.blackPlayer.rating})`
    });
    
    return data;
  } catch (error) {
    // Provide more detailed error information for debugging
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error when connecting to the backend server. Please check if the backend is running and accessible.');
      console.error(`Attempted to connect to: ${apiUrl}/games/${gameId}/players`);
      console.error('Original error:', error);
      throw new Error(`Network error: Unable to connect to the backend server at ${apiUrl}. Please check if the server is running.`);
    } else {
      console.error('Error fetching game players:', error);
      throw error;
    }
  }
}

/**
 * Fetches game result data including player details and rating changes
 * @param gameId The ID of the game to fetch result data for (MUST be the same as received from the server)
 * @returns Promise resolving to game result data with player details and rating changes
 */
export async function fetchGameResult(gameId: string): Promise<GameResultResponse> {
  console.log('Fetching game result data for gameId:', gameId);

  // Define multiple possible API URLs to try in order
  const apiUrls = [
    'http://localhost:3001',  // Primary API URL
    'http://localhost:3000/api',  // Next.js API route fallback
    window.location.origin    // Current origin as last resort
  ];
  
  // Ensure gameId is properly encoded for URL
  const encodedGameId = encodeURIComponent(gameId);
  
  // Get the current user's token for authentication
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const token = await user.getIdToken();
  
  // Try each API URL in sequence
  let lastError = null;
  
  for (const apiUrl of apiUrls) {
    try {
      console.log(`Trying to connect to backend API at ${apiUrl} for game result...`);
      
      const response = await fetch(`${apiUrl}/games/${encodedGameId}/result`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000) // Shorter timeout to move to next URL faster
      });

      if (!response.ok) {
        console.warn(`API at ${apiUrl} responded with status: ${response.status} ${response.statusText}`);
        lastError = new Error(`API error: ${response.status} ${response.statusText}`);
        continue; // Try next URL
      }

      // If we get here, we successfully connected
      console.log(`Successfully connected to backend API at ${apiUrl}`);
      const data = await response.json();
      
      // Validate the response data
      if (!data || !data.whitePlayer || !data.blackPlayer) {
        console.warn(`Invalid game result data received from ${apiUrl}:`, data);
        lastError = new Error('Invalid game result data format received from server');
        continue; // Try next URL
      }
      
      // Log the successful data retrieval
      console.log('Game result data retrieved successfully:', {
        status: data.status,
        resultType: data.resultType,
        endReason: data.endReason,
        white: `${data.whitePlayer.username} (${data.whitePlayer.rating}) ${data.whitePlayer.ratingChange >= 0 ? '+' : ''}${data.whitePlayer.ratingChange}`,
        black: `${data.blackPlayer.username} (${data.blackPlayer.rating}) ${data.blackPlayer.ratingChange >= 0 ? '+' : ''}${data.blackPlayer.ratingChange}`
      });
      
      return data;
    } catch (error) {
      console.warn(`Error connecting to ${apiUrl}:`, error);
      lastError = error;
      // Continue to next URL
    }
  }
  
  // If we get here, all URLs failed
  console.error('All API URLs failed for game result fetch');
  throw lastError || new Error('Failed to fetch game result from any API endpoint');
}
