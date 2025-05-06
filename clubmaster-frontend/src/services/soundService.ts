import { io, Socket } from 'socket.io-client';

// Define types
export interface PlayerSoundSettings {
  userId: string;
  soundEnabled: boolean;
}

// Socket server URL - Using the same URL for backend services
// Adjust these URLs based on your actual backend deployment
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Sound socket connection
let soundSocket: Socket | null = null;

/**
 * Initialize and get the sound socket connection
 * @returns Socket instance for sound settings
 */
export const getSoundSocket = (): Socket => {
  if (!soundSocket) {
    try {
      soundSocket = io(`${SOCKET_SERVER_URL}/sound`, {
        transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000, // Increase timeout
        forceNew: true, // Create a new connection each time
      });

      // Setup event handlers
      soundSocket.on('connect', () => {
        console.log('Connected to sound socket');
      });

      soundSocket.on('connect_error', (error) => {
        console.error('Sound socket connection error:', error);
      });

      soundSocket.on('disconnect', () => {
        console.log('Disconnected from sound socket');
      });

      soundSocket.on('soundSettingsUpdated', (settings: PlayerSoundSettings) => {
        console.log('Sound settings updated:', settings);
        // You can add additional handlers here if needed
      });
    } catch (error) {
      console.error('Error creating sound socket:', error);
      // Create a dummy socket that won't throw errors but won't do anything
      // This prevents the app from crashing if the socket server is unavailable
      soundSocket = {
        emit: () => {},
        on: () => {},
        off: () => {},
        disconnect: () => {},
        connected: false,
      } as unknown as Socket;
    }
  }
  
  return soundSocket;
};

/**
 * Disconnect the sound socket
 */
export const disconnectSoundSocket = (): void => {
  if (soundSocket) {
    try {
      soundSocket.disconnect();
    } catch (error) {
      console.error('Error disconnecting sound socket:', error);
    } finally {
      soundSocket = null;
    }
  }
};

/**
 * Get a user's sound settings via WebSocket
 * @param userId The user ID
 * @returns Promise that resolves to the user's sound settings
 */
export const getSoundSettingsViaSocket = (userId: string): Promise<PlayerSoundSettings> => {
  const socket = getSoundSocket();

  return new Promise((resolve) => {
    // If socket is not connected, return default settings
    if (!socket.connected) {
      console.warn('Sound socket not connected. Using default settings.');
      return resolve({ userId, soundEnabled: true });
    }
    
    socket.emit('getSoundSettings', userId);
    
    const timeoutId = setTimeout(() => {
      socket.off('soundSettingsResponse');
      console.warn('Sound settings request timed out. Using default settings.');
      resolve({ userId, soundEnabled: true });
    }, 5000);
    
    const handleResponse = (settings: PlayerSoundSettings) => {
      clearTimeout(timeoutId);
      socket.off('soundSettingsResponse', handleResponse);
      resolve(settings);
    };
    
    socket.on('soundSettingsResponse', handleResponse);
  });
};

/**
 * Toggle sound settings via WebSocket
 * @param userId The user ID
 * @param enabled Whether sound is enabled
 * @returns Promise that resolves to the updated sound settings
 */
export const toggleSoundViaSocket = (userId: string, enabled: boolean): Promise<PlayerSoundSettings> => {
  const socket = getSoundSocket();

  return new Promise((resolve) => {
    // If socket is not connected, return updated settings without making server call
    if (!socket.connected) {
      console.warn('Sound socket not connected. Using local settings only.');
      return resolve({ userId, soundEnabled: enabled });
    }
    
    socket.emit('toggleSound', { userId, enabled });
    
    const timeoutId = setTimeout(() => {
      socket.off('soundSettingsUpdated');
      console.warn('Sound toggle request timed out. Using local settings only.');
      resolve({ userId, soundEnabled: enabled });
    }, 5000);
    
    const handleResponse = (settings: PlayerSoundSettings) => {
      clearTimeout(timeoutId);
      socket.off('soundSettingsUpdated', handleResponse);
      resolve(settings);
    };
    
    socket.on('soundSettingsUpdated', handleResponse);
  });
};

/**
 * Get a user's sound settings via REST API
 * @param userId The user ID
 * @returns Promise that resolves to the user's sound settings
 */
export const getSoundSettings = async (userId: string): Promise<PlayerSoundSettings> => {
  try {
    // First try to get settings from localStorage for immediate response
    if (typeof localStorage !== 'undefined') {
      const storedValue = localStorage.getItem('soundEnabled');
      
      // Default to true if no setting found
      const localSoundEnabled = storedValue !== null ? storedValue === 'true' : true;
      
      const defaultSettings = { 
        userId, 
        soundEnabled: localSoundEnabled
      };
      
      // Try to get settings from server in the background
      fetchSettingsFromServer(userId)
        .then(serverSettings => {
          // Update localStorage if server settings differ from local
          if (serverSettings.soundEnabled !== localSoundEnabled) {
            console.log('Updating local sound settings from server:', serverSettings);
            localStorage.setItem('soundEnabled', serverSettings.soundEnabled.toString());
          }
        })
        .catch(() => {
          // Silent catch - we already return default settings
        });
      
      return defaultSettings;
    }
    
    // If localStorage is not available, try the server
    return await fetchSettingsFromServer(userId);
  } catch (error) {
    console.error('Error getting sound settings:', error);
    // Return default settings if all methods fail
    return { userId, soundEnabled: true };
  }
};

/**
 * Helper function to fetch settings from server
 */
const fetchSettingsFromServer = async (userId: string): Promise<PlayerSoundSettings> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${API_BASE_URL}/api/sound/${userId}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive'
      },
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'include', // Include cookies if needed
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to get sound settings: ${response.statusText} (${response.status})`);
    }
    
    return await response.json();
  } catch (error) {
    // Re-throw the error to be handled by the caller
    throw error;
  }
};

/**
 * Update a user's sound settings via REST API
 * @param userId The user ID
 * @param enabled Whether sound is enabled
 * @returns Promise that resolves to the updated sound settings
 */
export const updateSoundSettings = async (userId: string, enabled: boolean): Promise<PlayerSoundSettings> => {
  // Always update localStorage immediately
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('soundEnabled', enabled.toString());
  }
  
  try {
    // Attempt to update server settings
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(`${API_BASE_URL}/api/sound/${userId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify({ enabled }),
      signal: controller.signal,
      mode: 'cors', // Explicitly set CORS mode
      credentials: 'include', // Include cookies if needed
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorMsg = `Failed to update sound settings: ${response.statusText} (${response.status})`;
      console.info('Using local settings only -', errorMsg);
      throw new Error(errorMsg);
    }
    
    return await response.json();
  } catch (error: any) { // Type assertion for the error
    console.warn('Error updating sound settings on server:', error.message || String(error));
    console.info('Using local settings only');
    
    // Return updated settings even if API call fails
    return { userId, soundEnabled: enabled };
  }
}; 