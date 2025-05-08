import { io, Socket, ManagerOptions } from 'socket.io-client';

let socket: Socket | null = null;

// Update the socket URL to use port 3001
const SOCKET_SERVER_URL = 'http://localhost:3001';

// Default socket options
const DEFAULT_OPTIONS: Partial<ManagerOptions> = {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  path: '/socket.io'
};

/**
 * Initialize and get the socket connection
 * @param options Custom options to override defaults
 * @returns Socket instance
 */
export const getSocket = (options?: Partial<ManagerOptions>): Socket => {
  if (!socket) {
    socket = io(`${SOCKET_SERVER_URL}/chess`, {
      ...DEFAULT_OPTIONS,
      ...options
    });
    
    // Add connection debugging
    socket.on('connect', () => {
      console.log('Socket connected successfully to', SOCKET_SERVER_URL);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }
  
  return socket;
};

/**
 * Disconnect the socket
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Get the connection status
 * @returns True if socket is connected, false otherwise
 */
export const isConnected = (): boolean => {
  return socket?.connected || false;
};

/**
 * Rejoin a game after reconnection
 * @param gameId Game ID
 * @param playerId Player ID
 */
export const rejoinGame = (gameId: string, playerId: string): void => {
  if (socket?.connected) {
    socket.emit('rejoin_game', { gameId, playerId });
  }
};

/**
 * Join a game
 * @param gameOptions Game options
 */
export const joinGame = (gameOptions: { gameType: string }): void => {
  if (socket?.connected) {
    socket.emit('joinGame', gameOptions);
  }
};

/**
 * Start matchmaking to find an opponent
 * @param matchmakingOptions Options for matchmaking (gameMode, timeControl, etc.)
 */
export const startMatchmaking = (matchmakingOptions: { 
  gameMode?: string;
  timeControl?: string;
  rated?: boolean;
  preferredSide?: string;
}): void => {
  console.log('🔍 StartMatchmaking called with options:', matchmakingOptions);
  
  // Validate and format time control
  if (matchmakingOptions.timeControl) {
    // Ensure time control is in the correct format
    const timeControlStr = matchmakingOptions.timeControl;
    console.log('Processing time control:', timeControlStr);
    
    // Store the validated time control
    localStorage.setItem('timeControl', timeControlStr);
    console.log('📝 Stored time control in localStorage:', timeControlStr);
    
    // Store the game mode for consistency
    if (matchmakingOptions.gameMode) {
      localStorage.setItem('gameMode', matchmakingOptions.gameMode);
      console.log('📝 Stored game mode in localStorage:', matchmakingOptions.gameMode);
    }
  }
  
  if (socket?.connected) {
    console.log('🚀 Emitting startMatchmaking event with:', matchmakingOptions);
    socket.emit('startMatchmaking', matchmakingOptions);
  } else {
    console.error('⚠️ Cannot start matchmaking: Socket not connected');
  }
};

/**
 * Cancel an ongoing matchmaking request
 */
export const cancelMatchmaking = (): void => {
  if (socket?.connected) {
    socket.emit('cancelMatchmaking');
  }
};

/**
 * Add a listener for player disconnection events
 * @param callback Function to call when an opponent disconnects
 */
export const onOpponentDisconnect = (callback: (data: { playerId: string, gameId: string, reconnectTimeoutSeconds: number }) => void): void => {
  if (socket) {
    socket.on('opponent_disconnected', callback);
  }
};

/**
 * Remove the opponent disconnect listener
 */
export const offOpponentDisconnect = (callback?: (data: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('opponent_disconnected', callback);
    } else {
      socket.off('opponent_disconnected');
    }
  }
};

/**
 * Add a listener for opponent reconnection events
 * @param callback Function to call when an opponent reconnects
 */
export const onOpponentReconnect = (callback: (data: { playerId: string, gameId: string }) => void): void => {
  if (socket) {
    socket.on('opponent_reconnected', callback);
  }
};

/**
 * Remove the opponent reconnect listener
 */
export const offOpponentReconnect = (callback?: (data: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('opponent_reconnected', callback);
    } else {
      socket.off('opponent_reconnected');
    }
  }
};

/**
 * Add a listener for game timeout due to disconnection
 * @param callback Function to call when a game times out due to disconnection
 */
export const onGameTimeoutDueToDisconnection = (callback: (data: { 
  gameId: string, 
  winnerId: string, 
  loserId: string,
  reason: string
}) => void): void => {
  if (socket) {
    socket.on('game_timeout_disconnection', callback);
  }
};

/**
 * Remove the game timeout due to disconnection listener
 */
export const offGameTimeoutDueToDisconnection = (callback?: (data: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('game_timeout_disconnection', callback);
    } else {
      socket.off('game_timeout_disconnection');
    }
  }
};

/**
 * Add a listener for when a match is found
 * @param callback Function to call when a match is found
 */
export const onMatchFound = (callback: (gameData: any) => void): void => {
  if (socket) {
    socket.on('matchFound', callback);
  }
};

/**
 * Remove the match found listener
 */
export const offMatchFound = (callback?: (gameData: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('matchFound', callback);
    } else {
      socket.off('matchFound');
    }
  }
};

/**
 * Add a listener for matchmaking errors
 * @param callback Function to call when a matchmaking error occurs
 */
export const onMatchmakingError = (callback: (error: any) => void): void => {
  if (socket) {
    socket.on('matchmakingError', callback);
  }
};

/**
 * Remove the matchmaking error listener
 */
export const offMatchmakingError = (callback?: (error: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('matchmakingError', callback);
    } else {
      socket.off('matchmakingError');
    }
  }
};

/**
 * Add a listener for matchmaking status updates
 * @param callback Function to call when a matchmaking status update is received
 */
export const onMatchmakingStatus = (callback: (status: any) => void): void => {
  if (socket) {
    socket.on('matchmakingStatus', callback);
  }
};

/**
 * Remove the matchmaking status listener
 */
export const offMatchmakingStatus = (callback?: (status: any) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('matchmakingStatus', callback);
    } else {
      socket.off('matchmakingStatus');
    }
  }
};

/**
 * Offer a draw to the opponent
 * @param gameId Game ID
 */
export const offerDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('offer_draw', { gameId });
  }
};

/**
 * Accept a draw offer
 * @param gameId Game ID
 */
export const acceptDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('accept_draw', { gameId });
  }
};

/**
 * Decline a draw offer
 * @param gameId Game ID
 */
export const declineDraw = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('decline_draw', { gameId });
  }
};

/**
 * Resign from a game
 * @param gameId Game ID
 */
export const resignGame = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('resign_game', { gameId });
  }
};

/**
 * Abort a game
 * @param gameId Game ID
 */
export const abortGame = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('abort_game', { gameId });
  }
};

// Map a timeControl string (e.g. "3+0") to the backend's TimeControl enum
export const mapTimeControlToEnum = (timeControlStr: string): string => {
  try {
    // Extract minutes part from the timeControlStr (format: "3+0", "5+0", etc.)
    const minutes = parseInt(timeControlStr.split('+')[0]);
    
    // Map to backend enum values with exact time matches
    if (minutes === 3) return 'BULLET';
    if (minutes === 5) return 'BLITZ';
    if (minutes === 10) return 'RAPID';
    
    // Fallback mapping for non-standard times
    if (minutes <= 3) return 'BULLET';
    if (minutes <= 5) return 'BLITZ';
    return 'RAPID';
  } catch (error) {
    console.error('Error mapping time control to enum:', error);
    return 'BLITZ'; // Default fallback
  }
};

/**
 * Initialize the game timer
 */
export const initializeTimer = (gameId: string, timeControl: string): void => {
  if (!socket?.connected) {
    console.error('Cannot initialize timer: Socket not connected');
    return;
  }

  try {
    // Map the time control to the backend enum before sending
    const timeControlEnum = mapTimeControlToEnum(timeControl);
    console.log('Initializing timer with:', { gameId, timeControl, timeControlEnum });
    socket.emit('initializeTimer', { gameId, timeControl: timeControlEnum });
  } catch (error) {
    console.error('Error initializing timer:', error);
  }
};

// Helper function to format time control
const formatTimeControl = (timeControl: string): string => {
  try {
    // If it's already in the correct format (e.g., "3+0"), return as is
    if (/^\d+\+\d+$/.test(timeControl)) {
      return timeControl;
    }

    // If it's just a number (e.g., "3"), format it
    const minutes = parseInt(timeControl);
    if (!isNaN(minutes)) {
      return `${minutes}+0`;
    }

    throw new Error('Invalid time control format');
  } catch (error) {
    console.error('Error formatting time control:', error);
    return '5+0'; // Default fallback
  }
};

/**
 * Get the current timer state for a game
 * @param gameId The ID of the game
 */
export const getTimerState = (gameId: string): void => {
  console.log('🕒 Getting timer state for game:', gameId);
  if (socket?.connected) {
    socket.emit('getTimerState', { gameId });
  } else {
    console.error('⚠️ Cannot get timer state: Socket not connected');
  }
}; 