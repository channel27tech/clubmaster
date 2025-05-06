import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getSoundSettings, 
  updateSoundSettings, 
  getSoundSocket, 
  disconnectSoundSocket,
  PlayerSoundSettings
} from '../services/soundService';
import { Socket } from 'socket.io-client';

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
      
      setIsLoading(true);
      setError(null);
      
      try {
        const settings = await getSoundSettings(userId);
        setSoundEnabled(settings.soundEnabled);
        
        // Update localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('soundEnabled', settings.soundEnabled.toString());
        }
      } catch (err) {
        console.error('Error initializing sound settings:', err);
        // Use current state (from localStorage) as fallback
        setError('Failed to load sound settings from server, using local preferences');
      } finally {
        setIsLoading(false);
        setInitializationAttempted(true);
      }
    };
    
    initializeSettings();
  }, [userId, initializationAttempted]);

  // Connect to sound socket for real-time updates with better error handling
  useEffect(() => {
    if (!userId) return;
    
    let socket: Socket | null = null;
    try {
      socket = getSoundSocket();
      
      // Listen for updates from server
      const handleSettingsUpdate = (settings: PlayerSoundSettings) => {
        if (settings.userId === userId) {
          setSoundEnabled(settings.soundEnabled);
          
          // Update localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('soundEnabled', settings.soundEnabled.toString());
          }
        }
      };
      
      socket.on('soundSettingsUpdated', handleSettingsUpdate);
      
      // Cleanup on unmount
      return () => {
        try {
          if (socket) {
            socket.off('soundSettingsUpdated', handleSettingsUpdate);
            disconnectSoundSocket();
          }
        } catch (err) {
          console.error('Error cleaning up socket:', err);
        }
      };
    } catch (err) {
      console.error('Error setting up sound socket:', err);
      return () => {}; // Empty cleanup function
    }
  }, [userId]);

  // Toggle sound function that updates API and local state with better error handling
  const toggleSound = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Update localStorage immediately for better UX
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('soundEnabled', enabled.toString());
      }
      
      // Update state immediately for better UX
      setSoundEnabled(enabled);
      
      // Then update server (which may fail but won't break the app)
      await updateSoundSettings(userId, enabled);
    } catch (err) {
      console.error('Error toggling sound:', err);
      // Show error but don't revert the local change, as we want to prioritize user preference
      setError('Could not sync sound settings with server, but your preference has been saved locally');
    } finally {
      setIsLoading(false);
    }
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