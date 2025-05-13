import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as socketService from '@/services/socketService';

interface MatchmakingManagerProps {
  defaultGameMode?: string;
  defaultTimeControl?: string;
  defaultSide?: string;
  onError?: (error: string) => void;
  onGameFound?: (gameId: string) => void;
}

export interface MatchmakingManagerHandle {
  startMatchmaking: (mode: string, time: string, playSide: string) => void;
}

/**
 * MatchmakingManager component
 * Manages the matchmaking process and handles transitions 
 * to the game screen when a match is found
 */
const MatchmakingManager = forwardRef<MatchmakingManagerHandle, MatchmakingManagerProps>(
  ({ defaultGameMode = 'Blitz', defaultTimeControl = '5', defaultSide = 'white', onError, onGameFound }, ref) => {
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
          router.push(`/play/game/${gameData.gameId}`);
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
    
    const startMatchmaking = (mode: string, time: string, playSide: string) => {
      console.log('StartMatchmaking called with:', { mode, time, playSide });
      setError(null);
      setIsMatchmaking(true);
      setGameMode(mode);
      setTimeControl(time);
      setSide(playSide);
      
      try {
        // Map the time value to the correct game mode and time control
        let effectiveGameMode = mode;
        let timeControlString = '';
        
        // Set the correct time control based on game mode
        switch (mode.toLowerCase()) {
          case 'bullet':
            timeControlString = '3+0';
            effectiveGameMode = 'Bullet';
            break;
          case 'blitz':
            timeControlString = '5+0';
            effectiveGameMode = 'Blitz';
            break;
          case 'rapid':
            timeControlString = '10+0';
            effectiveGameMode = 'Rapid';
            break;
          default:
            // If mode is not recognized, determine from time value
            const timeValue = parseInt(time);
            if (timeValue <= 3) {
              timeControlString = '3+0';
              effectiveGameMode = 'Bullet';
            } else if (timeValue <= 5) {
              timeControlString = '5+0';
              effectiveGameMode = 'Blitz';
            } else {
              timeControlString = '10+0';
              effectiveGameMode = 'Rapid';
            }
        }
        
        // Store in localStorage before starting matchmaking
        localStorage.setItem('timeControl', timeControlString);
        localStorage.setItem('gameMode', effectiveGameMode);
        console.log('MatchmakingManager stored timeControl in localStorage:', timeControlString);
        console.log('MatchmakingManager stored gameMode in localStorage:', effectiveGameMode);
        
        // Get or initialize socket
        const socket = socketService.getSocket();
        const isConnected = socketService.isConnected();
        console.log('Socket connection status:', isConnected);
        
        if (!isConnected) {
          console.log("Socket not connected, attempting to connect...");
          socket.connect();
          
          setTimeout(() => {
            if (socketService.isConnected()) {
              console.log("Socket connected after retry");
              socketService.startMatchmaking({
                gameMode: effectiveGameMode,
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
          socketService.startMatchmaking({
            gameMode: effectiveGameMode,
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
      window.startMatchmakingDebug = () => {
        console.log('Debug function called with:', { gameMode, timeControl, side });
        startMatchmaking(gameMode, timeControl, side);
      };
      
      // Also expose cancelMatchmaking to allow cancelling via console
      window.cancelMatchmakingDebug = () => {
        console.log('Cancel function called');
        cancelMatchmaking();
      };
    }
    
    // Expose the startMatchmaking function via ref
    useImperativeHandle(ref, () => ({
      startMatchmaking
    }));

    // Set up socket event listeners
    React.useEffect(() => {
      const socket = socketService.getSocket();
      
      socket.on('gameFound', (data: { gameId: string }) => {
        console.log('Game found:', data);
        onGameFound?.(data.gameId);
      });

      socket.on('matchmakingError', (error: string) => {
        console.error('Matchmaking error:', error);
        onError?.(error);
      });

      return () => {
        socket.off('gameFound');
        socket.off('matchmakingError');
      };
    }, [onGameFound, onError]);

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
  }
);

MatchmakingManager.displayName = 'MatchmakingManager';

export default MatchmakingManager; 