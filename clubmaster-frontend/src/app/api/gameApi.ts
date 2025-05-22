import { auth } from "@/firebase";

// Interface for player data returned from the API
export interface PlayerData {
  username: string;
  rating: number;
  photoURL: string | null;
}

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
 * @param gameId The ID of the game to fetch player data for
 * @returns Promise resolving to player data for white and black players
 */
export async function fetchGamePlayers(gameId: string): Promise<GamePlayersResponse> {
  // Use the full game ID as received - the backend will handle the extraction if needed
  console.log('Using full gameId for API call:', gameId);

  // Define potential API URLs to try (in order of preference)
  const potentialPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
  const baseUrl = 'http://localhost';
  let lastError = null;
  
  // We'll use this variable to track which port we're currently trying
  let currentPort = potentialPorts[0];
  let apiUrl = `${baseUrl}:${currentPort}`;
  
  try {
    // Get the current user's token for authentication
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    
    // Try each port until one works
    for (let i = 0; i < potentialPorts.length; i++) {
      currentPort = potentialPorts[i];
      apiUrl = `${baseUrl}:${currentPort}`;
      
      try {
        console.log(`Attempting to connect to backend on port ${currentPort}...`);
        const response = await fetch(`${apiUrl}/games/${gameId}/players`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          // Set a short timeout to quickly move to the next port if this one doesn't respond
          signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
          console.warn(`Port ${currentPort} responded but returned status: ${response.status} ${response.statusText}`);
          continue; // Try the next port
        }

        // If we get here, we found a working port!
        console.log(`Successfully connected to backend on port ${currentPort}`);
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
      } catch (portError: any) {
        console.warn(`Failed to connect to port ${currentPort}: ${portError?.message || 'Unknown error'}`);
        lastError = portError;
        // Continue to the next port
      }
    }
    
    // If we get here, none of the ports worked
    throw new Error(`Failed to connect to backend on any port. Last error: ${lastError?.message || 'Unknown error'}`);
  
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
 * @param gameId The ID of the game to fetch result data for
 * @returns Promise resolving to game result data with player details and rating changes
 */
export async function fetchGameResult(gameId: string): Promise<GameResultResponse> {
  console.log('Fetching game result data for gameId:', gameId);

  // Define potential API URLs to try (in order of preference)
  const potentialPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];
  const baseUrl = 'http://localhost';
  let lastError = null;
  
  // We'll use this variable to track which port we're currently trying
  let currentPort = potentialPorts[0];
  let apiUrl = `${baseUrl}:${currentPort}`;
  
  try {
    // Get the current user's token for authentication
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = await user.getIdToken();
    
    // Try each port until one works
    for (let i = 0; i < potentialPorts.length; i++) {
      currentPort = potentialPorts[i];
      apiUrl = `${baseUrl}:${currentPort}`;
      
      try {
        console.log(`Attempting to connect to backend on port ${currentPort} for game result...`);
        const response = await fetch(`${apiUrl}/games/${gameId}/result`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          // Set a short timeout to quickly move to the next port if this one doesn't respond
          signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
          console.warn(`Port ${currentPort} responded but returned status: ${response.status} ${response.statusText}`);
          continue; // Try the next port
        }

        // If we get here, we found a working port!
        console.log(`Successfully connected to backend on port ${currentPort}`);
        const data = await response.json();
        
        // Validate the response data
        if (!data || !data.whitePlayer || !data.blackPlayer) {
          console.error('Invalid game result data received:', data);
          throw new Error('Invalid game result data format received from server');
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
      } catch (portError: any) {
        console.warn(`Failed to connect to port ${currentPort} for game result: ${portError?.message || 'Unknown error'}`);
        lastError = portError;
        // Continue to the next port
      }
    }
    
    // If we get here, none of the ports worked
    throw new Error(`Failed to connect to backend on any port for game result. Last error: ${lastError?.message || 'Unknown error'}`);
  
  } catch (error) {
    // Provide more detailed error information for debugging
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error when connecting to the backend server. Please check if the backend is running and accessible.');
      console.error(`Attempted to connect to: ${apiUrl}/games/${gameId}/result`);
      console.error('Original error:', error);
      throw new Error(`Network error: Unable to connect to the backend server at ${apiUrl}. Please check if the server is running.`);
    } else {
      console.error('Error fetching game result:', error);
      throw error;
    }
  }
}
