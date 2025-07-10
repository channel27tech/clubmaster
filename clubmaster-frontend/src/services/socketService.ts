import { log } from 'console';
import { io, Socket, ManagerOptions } from 'socket.io-client';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 1000;

// Track active games for reconnection
let activeGameId: string | null = null;
let activePlayerId: string | null = null;

/**
 * Get the socket server URL based on the environment
 * @returns The socket server URL with namespace
 */
const getSocketServerUrl = (): string => {
  // Prefer environment variable if set
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  // For development, use localhost
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const host = window.location.hostname;
    const port = '3001';
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
  }

  // For production, use the current host
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_SOCKET_PORT || window.location.port || '3001';
    return `${protocol}://${host}:${port}`;
  }

  // Default fallback for SSR
  const fallbackUrl = 'http://localhost:3001';
  if (!fallbackUrl) {
    console.warn('[socketService] WARNING: Socket server URL is undefined! Check NEXT_PUBLIC_BACKEND_URL.');
  }
  return fallbackUrl;
};

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

// Connection status event handlers
const connectionStatusListeners: ((status: string, details?: string) => void)[] = [];

/**
 * Emit connection status to all registered listeners
 * @param status Connection status ('connected', 'disconnected', 'error', 'failed')
 * @param details Optional details about the status
 */
const emitConnectionStatus = (status: string, details?: string): void => {
  if (status === 'error' || status === 'failed') {
    console.error(`[socketService] Connection status: ${status}${details ? ` (${details})` : ''}`);
  }
  connectionStatusListeners.forEach((listener) => {
    try {
      listener(status, details);
    } catch (error) {
      console.error('[socketService] Error in connection status listener:', error);
    }
  });
};

/**
 * Register a listener for socket connection status changes
 * @param listener Function to call when connection status changes
 */
export const onConnectionStatusChange = (listener: (status: string, details?: string) => void): void => {
  connectionStatusListeners.push(listener);
  
  // Immediately emit current status if socket exists
  if (socket) {
    const currentStatus = socket.connected ? 'connected' : 'disconnected';
    listener(currentStatus);
  }
};

/**
 * Remove a connection status listener
 * @param listener The listener function to remove
 */
export const offConnectionStatusChange = (listener: (status: string, details?: string) => void): void => {
  const index = connectionStatusListeners.indexOf(listener);
  if (index !== -1) {
    connectionStatusListeners.splice(index, 1);
  }
};

/**
 * Attempt to reconnect the socket with exponential backoff
 */
const attemptReconnect = (): void => {
  if (!socket || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  
  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1), 30000);
  
  console.log(`[socketService] Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
  
  setTimeout(() => {
    if (!socket?.connected) {
      console.log(`[socketService] Reconnection attempt ${reconnectAttempts}`);
      socket?.connect();
    }
  }, delay);
};

/**
 * Handle successful reconnection by rejoining active games
 */
const handleReconnection = (): void => {
  console.log('[socketService] Reconnected successfully');
  reconnectAttempts = 0;
  
  // If we were in a game, attempt to rejoin it
  if (activeGameId && activePlayerId) {
    console.log(`[socketService] Attempting to rejoin game ${activeGameId}`);
    rejoinGame(activeGameId, activePlayerId);
  }
};

/**
 * Get or initialize the socket connection
 * @param options Socket.IO manager options
 * @param idToken Firebase ID token for authentication
 * @returns The socket instance
 */
export const getSocket = (
  options?: Partial<ManagerOptions> & { auth?: { [key: string]: unknown } },
  idToken?: string
): Socket => {
  if (socket) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }
  
  const socketServerUrl = getSocketServerUrl();
  
  // Prepare auth data
  const auth: { [key: string]: unknown } = {};
  
  if (idToken) {
    auth.token = idToken;
  }
  
  // Merge with any provided auth options
  if (options?.auth) {
    Object.assign(auth, options.auth);
  }
  
  // Setup socket connection with auth
  socket = io(`${socketServerUrl}/chess`, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000, // Increased timeout for better reliability
    auth,
    ...options,
  });
  
  // Setup socket event listeners for connection status
  socket.on('connect', () => {
    console.log(`[socketService] Socket connected with ID: ${socket?.id}`);
    emitConnectionStatus('connected');
    
    // Handle reconnection logic
    if (reconnectAttempts > 0) {
      handleReconnection();
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`[socketService] Socket disconnected. Reason: ${reason}`);
    emitConnectionStatus('disconnected', reason);
    
    // Attempt to reconnect for certain disconnect reasons
    if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
      attemptReconnect();
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('[socketService] Socket connection error:', error);
    emitConnectionStatus('error', error.message);
    attemptReconnect();
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log(`[socketService] Socket reconnected after ${attemptNumber} attempts`);
    emitConnectionStatus('connected');
    reconnectAttempts = 0;
    
    // Handle reconnection logic
    handleReconnection();
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`[socketService] Socket reconnection attempt ${attemptNumber}`);
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('[socketService] Socket reconnection error:', error);
    attemptReconnect();
  });
  
  socket.on('reconnect_failed', () => {
    console.error('[socketService] Socket reconnection failed after all attempts');
    emitConnectionStatus('failed');
    
    // Try a complete socket reset after all reconnection attempts fail
    setTimeout(() => {
      resetSocket();
    }, 5000);
  });
  
  return socket;
};

/**
 * Reset the socket connection completely
 */
export const resetSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  reconnectAttempts = 0;
  getSocket(); // Recreate the socket
};

/**
 * Disconnect the socket
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeGameId = null;
  activePlayerId = null;
};

/**
 * Get the connection status
 * @returns True if socket is connected, false otherwise
 */
export const isConnected = (): boolean => {
  const connected = socket?.connected || false;
  return connected;
};

/**
 * Set active game information for reconnection handling
 * @param gameId Game ID
 * @param playerId Player ID
 */
export const setActiveGame = (gameId: string, playerId: string): void => {
  activeGameId = gameId;
  activePlayerId = playerId;
  console.log(`[socketService] Set active game: ${gameId}, player: ${playerId}`);
};

/**
 * Clear active game information
 */
export const clearActiveGame = (): void => {
  activeGameId = null;
  activePlayerId = null;
};

/**
 * Rejoin a game after reconnection
 * @param gameId Game ID
 * @param playerId Player ID
 */
export const rejoinGame = (gameId: string, playerId: string): void => {
  if (socket?.connected) {
    console.log(`[socketService] Rejoining game ${gameId} as player ${playerId}`);
    socket.emit('rejoin_game', { gameId, playerId });
    
    // Store game info for future reconnections
    setActiveGame(gameId, playerId);
  } else {
    console.warn(`[socketService] Cannot rejoin game ${gameId}: Socket not connected`);
    
    // Store game info for when we reconnect
    setActiveGame(gameId, playerId);
    
    // Try to connect
    getSocket();
  }
};

/**
 * Join a game
 * @param gameOptions Game options
 */
export const joinGame = (gameOptions: { gameType: string }): void => {
  if (socket?.connected) {
    socket.emit('joinGame', gameOptions);
  } else {
    console.warn('[socketService] Cannot join game: Socket not connected');
    getSocket(); // Try to connect
  }
};

/**
 * Request board synchronization from the server
 * @param gameId Game ID
 * @param reason Reason for the sync request
 * @param clientState Optional current client state (FEN)
 */
export const requestBoardSync = (gameId: string, reason: string = 'manual_sync', clientState?: string): void => {
  if (!socket?.connected) {
    console.warn('[socketService] Cannot request board sync: Socket not connected');
    getSocket(); // Try to connect
    return;
  }
  
  console.log(`[socketService] Requesting board sync for game ${gameId}. Reason: ${reason}`);
  socket.emit('request_board_sync', {
    gameId,
    reason,
    clientState
  });
};

/**
 * Register a listener for board sync responses
 * @param callback Function to call when board sync response is received
 */
export const onBoardSync = (callback: (data: {
  gameId: string;
  fen: string;
  pgn: string;
  moveHistory: string[];
  whiteTurn: boolean;
  isCheck: boolean;
  isGameOver: boolean;
  timestamp: number;
  reason: string;
}) => void): void => {
  if (!socket) {
    console.warn('[socketService] Socket not initialized for onBoardSync');
    return;
  }
  
  socket.on('board_sync', callback);
};

/**
 * Remove a board sync listener
 * @param callback The listener function to remove
 */
export const offBoardSync = (callback?: (data: unknown) => void): void => {
  if (!socket) return;
  
  if (callback) {
    socket.off('board_sync', callback);
  } else {
    socket.off('board_sync');
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
  betChallengeId?: string;
}): void => {
  if (!socket) {
    console.error('[socketService] Cannot start matchmaking: Socket not initialized');
    getSocket(); // Try to initialize
    return;
  }

  if (!socket.connected) {
    console.warn('[socketService] Socket not connected, attempting to reconnect before starting matchmaking');
    socket.connect();
  }

  // Get Firebase UID directly from Firebase Auth if available
  import('firebase/auth').then(({ getAuth }) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    const firebaseUid = currentUser ? currentUser.uid : 'guest';
    const username = currentUser?.displayName || `Guest-${socket?.id?.substring(0, 5)}`;
    
    const payload = {
      ...matchmakingOptions,
      firebaseUid,
      username
    };
    
    console.log('[socketService] Starting matchmaking with payload:', payload);
    socket?.emit('startMatchmaking', payload);
  }).catch(error => {
    console.error('[socketService] Error getting Firebase auth:', error);
    
    // Fall back to guest mode
    const payload = {
      ...matchmakingOptions,
      firebaseUid: 'guest',
      username: `Guest-${socket?.id?.substring(0, 5)}`
    };
    
    console.log('[socketService] Starting matchmaking with guest payload:', payload);
    socket?.emit('startMatchmaking', payload);
  });
};

/**
 * Cancel an ongoing matchmaking request
 */
export const cancelMatchmaking = (): void => {
  if (socket?.connected) {
    console.log('Cancelling matchmaking');
    socket.emit('cancelMatchmaking');
  } else {
    console.warn('Cannot cancel matchmaking: Socket not connected');
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
}) => void): void => {
  if (!socket) {
    console.error('[socketService] Cannot add matchFound listener: Socket not initialized');
    return;
  }

  // Remove any existing listeners to prevent duplicates
  socket.off('matchFound');
  socket.off('bet_game_ready');
  
  // Add the matchFound listener for both regular and bet games
  socket.on('matchFound', (gameData: any) => {
    console.log('[socketService] Match found event received:', gameData);
    
    // Validate the game data
    if (!gameData || !gameData.gameId) {
      console.error('[socketService] Invalid game data received:', gameData);
      return;
    }

    // Store game ID in localStorage for reconnection
    localStorage.setItem('currentGameId', gameData.gameId);
    
    // If this is a bet game, wait for bet_game_ready event
    if (gameData.betChallengeId) {
      console.log('[socketService] Bet game detected, waiting for bet_game_ready event');
      socket.once('bet_game_ready', (betData: { gameId: string }) => {
        console.log('[socketService] Received bet_game_ready event:', betData);
        if (betData.gameId) {
          // Update the game ID with the one from bet_game_ready
          const updatedGameData = {
            ...gameData,
            gameId: betData.gameId
          };
          localStorage.setItem('currentGameId', betData.gameId);
          callback(updatedGameData);
        }
      });
    } else {
      // For regular games, call the callback immediately
      console.log('[socketService] Regular game, proceeding with gameId:', gameData.gameId);
      try {
        callback(gameData);
      } catch (error) {
        console.error('[socketService] Error in matchFound callback:', error);
      }
    }
  });
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
    return 'BLITZ'; // Default fallback
  }
};

/**
 * Initialize the game timer
 */
export const initializeTimer = (gameId: string, timeControl: string): void => {
  if (!socket?.connected) {
    return;
  }

  try {
    // Map the time control to the backend enum before sending
    const timeControlEnum = mapTimeControlToEnum(timeControl);
    socket.emit('initializeTimer', { gameId, timeControl: timeControlEnum });
  } catch (error) {
  }
};

/**
 * Get the current timer state for a game
 * @param gameId The ID of the game
 */
export const getTimerState = (gameId: string): void => {
  if (socket?.connected) {
    socket.emit('getTimerState', { gameId });
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
      resolve({ success: false, message: 'Socket not initialized' });
      return;
    }
    if (!socket.connected) {
      resolve({ success: false, message: 'Socket not connected' });
      return;
    }

    // Add a flag to track if the promise was resolved
    let isResolved = false;
    let timeoutId; // <-- Declare timeoutId in parent scope

    // Set up listener for authentication_result event (fallback if ack doesn't work)
    const authResultListener = (response: { success: boolean; message?: string; userId?: string }) => {
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
          resolve({ success: false, message: 'Authentication timeout' });
        }
      }, 10000); // 10 second timeout (increased from 5s)

    } catch (error) {
      // Clean up listener in case of error
      socket.off('authentication_result', authResultListener);
      reject(error);
    }
  });
};