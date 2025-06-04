import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as socketService from '@/services/socketService';
import { SidePreference, determinePlayerColor } from '@/utils/sideSelection';

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

// Define the window interface to properly type the window extensions
declare global {
  interface Window {
    startMatchmakingDebug?: () => void;
    cancelMatchmakingDebug?: () => void;
    testSideSelection?: (gameId?: string) => void;
  }
}

/**
 * MatchmakingManager component
 * Manages the matchmaking process and handles transitions 
 * to the game screen when a match is found
 */
const MatchmakingManager = forwardRef<MatchmakingManagerHandle, MatchmakingManagerProps>(
  ({ defaultGameMode = 'Rapid', defaultTimeControl = '10', defaultSide = 'white', onError, onGameFound }, ref) => {
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
        
        // Use the server-assigned player color
        if (!gameData || !gameData.playerColor) {
          console.error('Error: No player color assignment received from server');
          setError('Unable to start game - invalid color assignment');
          return;
        }
        
        // Get the server-assigned color
        const assignedColor = gameData.playerColor.toLowerCase();
        
        // Validate the assigned color
        if (assignedColor !== 'white' && assignedColor !== 'black') {
          console.error(`Invalid color received: ${assignedColor}`);
          setError('Invalid color assignment received');
          return;
        }
        
        console.log(`Server assigned player color: ${assignedColor}`);
        
        // Log details about the side assignment for debugging
        if (gameData.sideAssignment) {
          console.log('Side assignment details:', gameData.sideAssignment);
        }
        
        // Store the calculated player color in localStorage
        localStorage.setItem('playerColor', assignedColor);
        
        // Store timeControl in localStorage
        if (gameData && gameData.timeControl) {
          localStorage.setItem('timeControl', gameData.timeControl);
        } else {
          // Use the current timeControl as fallback
          localStorage.setItem('timeControl', `${timeControl}+0`);
        }
        
        // Navigate to the game screen with the game ID
        if (gameData && gameData.gameId) {
          console.log(`[MatchmakingManager] Navigating to game: /play/game/${gameData.gameId}`);
          
          // Check if this is a bet game
          if (gameData.betChallengeId) {
            console.log(`[MatchmakingManager] This is a bet game with bet challenge ID: ${gameData.betChallengeId}`);
          }
          
          // Notify parent component if callback is provided
          if (onGameFound) {
            console.log('[MatchmakingManager] Calling onGameFound callback');
            onGameFound(gameData.gameId);
          }
          
          // Use setTimeout to ensure the navigation happens after state updates
          setTimeout(() => {
            router.push(`/play/game/${gameData.gameId}`);
          }, 100);
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
    }, [router, isMatchmaking, side]);
    
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

      // Add a test function for side selection
      window.testSideSelection = (gameId?: string) => {
        if (!gameId) {
          gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          console.log(`No gameId provided, using generated ID: ${gameId}`);
        }
        
        import('@/utils/sideSelection').then(module => {
          // Run the comprehensive test of all combinations
          console.log('Running side selection logic tests...');
          module.testAllCombinations();
          
          // Add explanation about the server-side assignment
          console.log('\n====== IMPORTANT NOTE ======');
          console.log('Side selection is now handled by the server to ensure consistency.');
          console.log('Both clients receive their final color assignment without needing to calculate it.');
          console.log('============================');
        }).catch(err => {
          console.error('Failed to load sideSelection module:', err);
        });
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