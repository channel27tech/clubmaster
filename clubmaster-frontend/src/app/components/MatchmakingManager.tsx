import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as socketService from '@/services/socketService';

interface MatchmakingManagerProps {
  defaultGameMode?: string;
  defaultTimeControl?: string;
  defaultSide?: string;
}

/**
 * MatchmakingManager component
 * Manages the matchmaking process and handles transitions 
 * to the game screen when a match is found
 */
const MatchmakingManager: React.FC<MatchmakingManagerProps> = ({
  defaultGameMode = 'Blitz',
  defaultTimeControl = '5',
  defaultSide = 'white',
}) => {
  const router = useRouter();
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<string>(defaultGameMode);
  const [timeControl, setTimeControl] = useState<string>(defaultTimeControl);
  const [side, setSide] = useState<string>(defaultSide);
  
  // Mock player info - in a real app this would come from auth state
  const playerInfo = {
    username: 'sup1981',
    rating: 1762
  };
  
  useEffect(() => {
    // Setup socket listeners when component mounts
    const handleMatchFound = (gameData: any) => {
      console.log('Match found with gameData:', gameData);
      setIsMatchmaking(false);
      
      // Store playerColor in localStorage for use on the game page
      if (gameData && gameData.playerColor) {
        // Make sure playerColor is a valid value
        const color = gameData.playerColor.toLowerCase();
        if (color === 'white' || color === 'black') {
          localStorage.setItem('playerColor', color);
          console.log('Stored player color in localStorage:', color);
        } else {
          console.error('Invalid player color received:', gameData.playerColor);
        }
      } else {
        console.warn('No playerColor in gameData');
      }
      
      // Store timeControl in localStorage
      if (gameData && gameData.timeControl) {
        localStorage.setItem('timeControl', gameData.timeControl);
        console.log('Stored time control in localStorage:', gameData.timeControl);
      } else {
        console.warn('No timeControl in gameData');
        // Use the current timeControl as fallback
        localStorage.setItem('timeControl', `${timeControl}+0`);
        console.log('Stored fallback time control in localStorage:', `${timeControl}+0`);
      }
      
      // Navigate to the game screen with the game ID
      if (gameData && gameData.gameId) {
        router.push(`/game/${gameData.gameId}`);
      }
    };
    
    const handleMatchmakingError = (error: any) => {
      console.error('Matchmaking error:', error);
      setError(error.message || 'An error occurred during matchmaking');
      setIsMatchmaking(false);
    };
    
    // Register event listeners
    socketService.onMatchFound(handleMatchFound);
    socketService.onMatchmakingError(handleMatchmakingError);
    
    // Clean up listeners when component unmounts
    return () => {
      socketService.offMatchFound(handleMatchFound);
      socketService.offMatchmakingError(handleMatchmakingError);
      
      // Cancel matchmaking if component unmounts while matchmaking is active
      if (isMatchmaking) {
        socketService.cancelMatchmaking();
      }
    };
  }, [router, isMatchmaking]);
  
  const startMatchmaking = (mode = defaultGameMode, time = defaultTimeControl, playSide = defaultSide) => {
    console.log('StartMatchmaking called with:', { mode, time, playSide });
    setError(null);
    setIsMatchmaking(true);
    setGameMode(mode);
    setTimeControl(time);
    setSide(playSide);
    
    try {
      // Format time control as the backend expects: "5+0" format
      const timeControlString = `${time}+0`;
      
      // Get or initialize socket
      const socket = socketService.getSocket();
      const isConnected = socketService.isConnected();
      console.log('Socket connection status:', isConnected);
      
      if (!isConnected) {
        console.log("Socket not connected, attempting to connect...");
        // Try to initialize socket connection
        socket.connect();
        
        // Set a timeout to check if connection succeeded
        setTimeout(() => {
          if (socketService.isConnected()) {
            console.log("Socket connected after retry");
            // Now that we're connected, start matchmaking
            socketService.startMatchmaking({
              gameMode: mode,
              timeControl: timeControlString,
              rated: true,
              preferredSide: playSide
            });
          } else {
            console.error("Socket connection failed after retry");
            setError("Unable to connect to game server. Please try again.");
            setIsMatchmaking(false);
          }
        }, 1000);
      } else {
        // Socket is already connected, start matchmaking immediately
        socketService.startMatchmaking({
          gameMode: mode,
          timeControl: timeControlString,
          rated: true,
          preferredSide: playSide
        });
      }
    } catch (err) {
      console.error('Error in startMatchmaking:', err);
      setError("An error occurred while starting matchmaking");
      setIsMatchmaking(false);
    }
  };
  
  const cancelMatchmaking = () => {
    console.log('Cancelling matchmaking');
    try {
      socketService.cancelMatchmaking();
    } catch (err) {
      console.error('Error in cancelMatchmaking:', err);
    }
    setIsMatchmaking(false);
  };
  
  // For debugging - expose the startMatchmaking function to the window object
  if (typeof window !== 'undefined') {
    (window as any).startMatchmakingDebug = () => {
      console.log('Debug function called');
      startMatchmaking('Blitz', '5', 'white');
    };
    
    // Also expose cancelMatchmaking to allow cancelling via console
    (window as any).cancelMatchmakingDebug = () => {
      console.log('Cancel function called');
      cancelMatchmaking();
    };
  }
  
  return (
    <>
      {error && !isMatchmaking && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-md shadow-lg z-50">
          <div className="font-semibold">Error</div>
          <div>{error}</div>
        </div>
      )}
      
      {/* Expose methods for parent components */}
      <div style={{ display: 'none' }}
        data-matchmaking-active={isMatchmaking}
        id="matchmaking-manager-control"
      >
        <button 
          onClick={() => startMatchmaking(gameMode, timeControl, side)}
          id="start-matchmaking-button"
        >
          Start Matchmaking
        </button>
        <button 
          onClick={cancelMatchmaking}
          id="cancel-matchmaking-button"
        >
          Cancel Matchmaking
        </button>
      </div>
    </>
  );
};

export default MatchmakingManager; 