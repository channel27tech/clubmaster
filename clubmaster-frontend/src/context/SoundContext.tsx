import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getSoundSettings, 
  updateSoundSettings, 
  PlayerSoundSettings
} from '../services/soundService';

// Define context type
interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Create context with default values
const SoundContext = createContext<SoundContextType>({
  soundEnabled: true,
  toggleSound: async () => {},
  isLoading: false,
  error: null
});

// Custom hook to use the sound context
export const useSound = () => useContext(SoundContext);

// Props for the provider component
interface SoundProviderProps {
  children: React.ReactNode;
  userId: string;
}

// Sound provider component
export const SoundProvider: React.FC<SoundProviderProps> = ({ children, userId }) => {
  // Initialize from localStorage immediately for better UX
  const getInitialSoundEnabled = (): boolean => {
    if (typeof localStorage !== 'undefined') {
      const storedPreference = localStorage.getItem('soundEnabled');
      return storedPreference !== null ? storedPreference === 'true' : true;
    }
    return true;
  };
  
  const [soundEnabled, setSoundEnabled] = useState<boolean>(getInitialSoundEnabled);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initializationAttempted, setInitializationAttempted] = useState<boolean>(false);

  // Initialize sound settings from API with better error handling
  useEffect(() => {
    const initializeSettings = async () => {
      if (!userId || initializationAttempted) return;
      
      try {
        // Immediately use local setting first to avoid waiting
        const localSetting = getInitialSoundEnabled();
        setSoundEnabled(localSetting);
        
        // Then try to get settings from API in background
        setIsLoading(true);
        const settings = await getSoundSettings(userId);
        
        // Only update state if different from local setting
        if (settings.soundEnabled !== localSetting) {
          setSoundEnabled(settings.soundEnabled);
        }
      } catch (err) {
        // Use current state (from localStorage) as fallback
        // No need to set error state as we already have a working local setting
      } finally {
        setIsLoading(false);
        setInitializationAttempted(true);
      }
    };
    
    initializeSettings();
  }, [userId]);

  // Toggle sound function without any direct WebSocket operations
  const toggleSound = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    
    // Update local state immediately without waiting
    setSoundEnabled(enabled);
    
    // Update localStorage immediately
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('soundEnabled', enabled.toString());
    }
    
    // Use a completely separate async process for server updates
    // This ensures the sound toggle operation is completely isolated from game state
    const updateServerInBackground = () => {
      // Use setTimeout with zero delay to move this to the next event loop tick
      // This completely decouples it from the current execution context
      setTimeout(async () => {
        try {
          // Use a local variable to track loading state to avoid state updates during critical operations
          let isUpdating = true;
          
          // Perform the server update
          await updateSoundSettings(userId, enabled);
          
          isUpdating = false;
        } catch (err) {
          // Don't update any state here - keep the error isolated
        }
      }, 0);
    };
    
    // Fire and forget - completely decouple from the main execution flow
    updateServerInBackground();
    
    // Return immediately to minimize any impact on the UI
    return;
  }, [userId]);

  // Context value
  const value = {
    soundEnabled,
    toggleSound,
    isLoading,
    error
  };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}; 