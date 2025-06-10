import { io, Socket, ManagerOptions } from 'socket.io-client';

let socket: Socket | null = null;

// Update the socket URL to use port 3001
// Fix: Use environment variable or fallback to localhost
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';

// Default socket options
const DEFAULT_OPTIONS: Partial<ManagerOptions> = {
  transports: ['websocket', 'polling'],  // Allow polling as fallback
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,  // Keep trying to reconnect
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,  // Increase timeout
  path: '/socket.io',
  forceNew: false,  // Allow reusing existing connections
  multiplex: true   // Enable multiplexing
};

/**
 * Initialize and get the socket connection
 * @param options Custom options to override defaults
 * @param idToken Optional Firebase ID token for authentication
 * @returns Socket instance
 */
export const getSocket = (options?: Partial<ManagerOptions> & { auth?: { [key: string]: unknown } }, idToken?: string): Socket => {
  if (!socket) {
    const finalOptions: Partial<ManagerOptions> & { auth?: { [key: string]: unknown }, extraHeaders?: { [key: string]: string } } = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Add authentication token to headers if provided
    if (idToken) {
      finalOptions.extraHeaders = {
        Authorization: `Bearer ${idToken}`,
      };
    }

    // Fix: Ensure we have a valid URL and log it
    const serverUrl = SOCKET_SERVER_URL || 'http://localhost:3001';
    console.log('Connecting to socket server:', serverUrl);
    
    socket = io(`${serverUrl}/chess`, finalOptions);
    
    // Add connection debugging
    socket.on('connect', () => {
      console.log('Socket connected successfully to', serverUrl);
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
  if (!socket) {
    console.error('⚠️ Cannot start matchmaking: Socket not initialized');
    return;
  }

  // Get Firebase UID directly from Firebase Auth if available
  import('firebase/auth').then(({ getAuth }) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    const firebaseUid = currentUser ? currentUser.uid : 'guest';
    const username = currentUser?.displayName || null;
    
    console.log('🔑 Firebase UID:', firebaseUid !== 'guest' ? 'Found' : 'Not found (guest)');
    if (firebaseUid !== 'guest') {
      console.log('👤 Authenticated user:', username || 'Unknown');
    }

    // Add time control to localStorage for consistency across app
    const timeControlStr = matchmakingOptions.timeControl || '10+0';
    // Validate time control format before storing
    if (/^\d+\+\d+$/.test(timeControlStr)) {
      // Store the validated time control
      localStorage.setItem('timeControl', timeControlStr);
      console.log('📝 Stored time control in localStorage:', timeControlStr);
    } else {
      console.warn('⚠️ Invalid time control format:', timeControlStr);
    }
    
    // Store the game mode for consistency
    if (matchmakingOptions.gameMode) {
      localStorage.setItem('gameMode', matchmakingOptions.gameMode);
      console.log('📝 Stored game mode in localStorage:', matchmakingOptions.gameMode);
    }

    // Add Firebase UID and username to matchmaking options
    const updatedMatchmakingOptions = {
      ...matchmakingOptions,
      firebaseUid,
      username
    };

    if (socket?.connected) {
      console.log('🚀 Emitting startMatchmaking event with:', updatedMatchmakingOptions);
      socket.emit('startMatchmaking', updatedMatchmakingOptions);
    } else {
      console.error('⚠️ Cannot start matchmaking: Socket not connected');
    }
  }).catch(error => {
    console.error('⚠️ Error importing Firebase Auth:', error);
    
    // Fallback to guest mode
    const updatedMatchmakingOptions = {
      ...matchmakingOptions,
      firebaseUid: 'guest'
    };
    
    if (socket?.connected) {
      console.log('🚀 Emitting startMatchmaking event with (guest fallback):', updatedMatchmakingOptions);
      socket.emit('startMatchmaking', updatedMatchmakingOptions);
    }
  });
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
export const offOpponentDisconnect = (callback?: (data: unknown) => void): void => {
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
export const offOpponentReconnect = (callback?: (data: unknown) => void): void => {
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
export const offGameTimeoutDueToDisconnection = (callback?: (data: unknown) => void): void => {
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
export const onMatchFound = (callback: (gameData: {
  gameId: string;
  timeControl?: string;
  gameMode?: string;
  rated?: boolean;
  playerColor: 'white' | 'black';  // Server-assigned color for this player
  opponentColor: 'white' | 'black'; // Server-assigned color for opponent
  opponentPreferredSide?: 'white' | 'black' | 'random';
  whitePlayer?: {
    socketId: string;
    rating: number;
    username?: string;
  };
  blackPlayer?: {
    socketId: string;
    rating: number;
    username?: string;
  };
  sideAssignment?: {
    player1: {
      socketId: string;
      preferredSide: 'white' | 'black' | 'random';
      assignedColor: 'white' | 'black';
    };
    player2: {
      socketId: string;
      preferredSide: 'white' | 'black' | 'random';
      assignedColor: 'white' | 'black';
    };
  };
  created?: Date;
}) => void): void => {
  if (socket) {
    socket.on('matchFound', (data) => {
      console.log('Match found event received:', data);
      
      // Validate essential data
      if (!data || !data.gameId || !data.playerColor) {
        console.error('Invalid match data received:', data);
      }
      
      callback(data);
    });
  }
};

/**
 * Remove the match found listener
 */
export const offMatchFound = (callback?: (gameData: unknown) => void): void => {
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
export const onMatchmakingError = (callback: (error: unknown) => void): void => {
  if (socket) {
    socket.on('matchmakingError', callback);
  }
};

/**
 * Remove the matchmaking error listener
 */
export const offMatchmakingError = (callback?: (error: unknown) => void): void => {
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
export const onMatchmakingStatus = (callback: (status: unknown) => void): void => {
  if (socket) {
    socket.on('matchmakingStatus', callback);
  }
};

/**
 * Remove the matchmaking status listener
 */
export const offMatchmakingStatus = (callback?: (status: unknown) => void): void => {
  if (socket) {
    if (callback) {
      socket.off('matchmakingStatus', callback);
    } else {
      socket.off('matchmakingStatus');
    }
  }
};

/**
 * Resign from a game
 * @param gameId Game ID
 */
export const resignGame = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('resign', { gameId });
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

/**
 * Get the socket ID
 * @returns Socket ID string or null if socket is not connected
 */
export const getSocketId = (): string | null => {
  return socket?.id ?? null;
};

/**
 * Authenticate the socket connection with a Firebase ID token
 * @param idToken The Firebase ID token
 * @returns Promise that resolves when the authentication is complete
 */
export const authenticateSocket = (idToken: string): Promise<{ success: boolean; message?: string; userId?: string }> => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      console.error('Cannot authenticate socket: Socket not initialized');
      // Resolve with failure instead of undefined
      resolve({ success: false, message: 'Socket not initialized' });
      return;
    }
    if (!socket.connected) {
      console.error('Cannot authenticate socket: Socket not connected');
      // Resolve with failure instead of undefined
      resolve({ success: false, message: 'Socket not connected' });
      return;
    }

    // Add a flag to track if the promise was resolved
    let isResolved = false;
    let timeoutId; // <-- Declare timeoutId in parent scope

    // Set up listener for authentication_result event (fallback if ack doesn't work)
    const authResultListener = (response: { success: boolean; message?: string; userId?: string }) => {
      console.log('Received authentication_result event:', response);
      if (!isResolved) {
        isResolved = true;
        // Clean up listener to avoid memory leaks
        socket.off('authentication_result', authResultListener);
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(response);
      }
    };
    
    // Add the listener before emitting the authenticate event
    socket.on('authentication_result', authResultListener);

    console.log('Attempting to send authenticate event...');
    try {
      socket.emit('authenticate', { token: idToken }, (response: { success: boolean; message?: string; userId?: string }) => {
        // This callback runs when the server acknowledges the authentication
        console.log('Received authenticate acknowledgement:', response);
        
        // Only resolve if we haven't already
        if (!isResolved) {
          isResolved = true;
          // Remove the event listener since we got the ack
          socket.off('authentication_result', authResultListener);
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          // Resolve with the actual response from the server
          if (response && typeof response === 'object') {
            resolve(response);
          } else {
            // If we got an invalid response, resolve with a failure
            resolve({ success: false, message: 'Invalid response from server' });
          }
        }
      });

      // Add a timeout in case the server never responds
      timeoutId = setTimeout(() => {
        // Only resolve if we haven't already
        if (!isResolved) {
          isResolved = true;
          // Remove the event listener since we're timing out
          socket.off('authentication_result', authResultListener);
          console.warn('Authentication response timeout - assuming failed');
          resolve({ success: false, message: 'Authentication timeout' });
        }
      }, 10000); // 10 second timeout (increased from 5s)

    } catch (error) {
      // Clean up listener in case of error
      socket.off('authentication_result', authResultListener);
      console.error('Error emitting authenticate event:', error);
      reject(error);
    }
  });
};