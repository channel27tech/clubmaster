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
      console.log('Match found:', gameData);
      setIsMatchmaking(false);
      
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
      // Get socket but don't check connection
      const socket = socketService.getSocket();
      console.log('Socket connection status:', socketService.isConnected());
      
      // Start matchmaking anyway
      socketService.startMatchmaking({
        gameMode: mode,
        timeControl: `${time}+0`,
        rated: true,
        preferredSide: playSide
      });
    } catch (err) {
      console.error('Error in startMatchmaking:', err);
      // Still keep matchmaking status active for UI
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