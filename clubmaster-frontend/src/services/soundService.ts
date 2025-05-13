import { Socket } from 'socket.io-client';

// Define types
export interface PlayerSoundSettings {
  userId: string;
  soundEnabled: boolean;
}

// API URL for backend services
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// No socket connection for sound updates - completely removed to avoid interfering with game sockets

/**
 * Get a user's sound settings
 * @param userId The user ID
 * @returns Promise that resolves to the user's sound settings
 */
export const getSoundSettings = async (userId: string): Promise<PlayerSoundSettings> => {
  try {
    // First try to get settings from localStorage - this is now the source of truth
    if (typeof localStorage !== 'undefined') {
      const storedValue = localStorage.getItem('soundEnabled');
      
      // Default to true if no setting found
      const localSoundEnabled = storedValue !== null ? storedValue === 'true' : true;
      
      // Return immediately with local settings to ensure UI responsiveness
      const settings = { 
        userId, 
        soundEnabled: localSoundEnabled
      };
      
      // Try to fetch from server in the background only to ensure server eventually syncs
      // Don't wait for the result and don't use it to update local state
      setTimeout(() => {
        fetchSettingsFromServer(userId)
          .then(serverSettings => {
            // Only update localStorage if server setting differs and only after a delay
            if (serverSettings.soundEnabled !== localSoundEnabled) {
              console.log('Background update of sound setting from server:', serverSettings);
              localStorage.setItem('soundEnabled', serverSettings.soundEnabled.toString());
            }
          })
          .catch(err => {
            console.warn('Could not get settings from server (background):', err);
            // No action needed - local settings remain unchanged
          });
      }, 500); // Half-second delay to avoid any potential WebSocket conflicts

      return settings;
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
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/api/sound/${userId}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
      mode: 'cors', // Explicitly set CORS mode
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
 * Update a user's sound settings
 * @param userId The user ID
 * @param enabled Whether sound is enabled
 */
export const updateSoundSettings = async (userId: string, enabled: boolean): Promise<PlayerSoundSettings> => {
  try {
    // Always update localStorage first for immediate UI feedback - local is source of truth
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('soundEnabled', enabled.toString());
    }
    
    // Update server in the background only - don't block or wait for response
    setTimeout(async () => {
      try {
        await updateSoundSettingsViaRest(userId, enabled);
        console.log('Successfully updated server sound settings in background');
      } catch (error) {
        console.warn('Background server update failed, local settings remain valid:', error);
        // No action needed - local settings were already updated
      }
    }, 500); // Significant delay to ensure no interference with game state
    
    // Return immediately with local settings
    return { userId, soundEnabled: enabled };
  } catch (error) {
    console.error('Error updating sound settings:', error);
    // Return local settings even if there was an error
    return { userId, soundEnabled: enabled };
  }
};

/**
 * Update sound settings via REST API
 * This avoids issues with WebSocket operations
 */
const updateSoundSettingsViaRest = async (userId: string, enabled: boolean): Promise<PlayerSoundSettings> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/api/sound/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ enabled }),
      signal: controller.signal,
      mode: 'cors',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to update sound settings: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('REST update error:', error);
    throw error;
  }
}; 