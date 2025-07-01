'use client';

import React, { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as socketService from '@/services/socketService';
import { SidePreference, determinePlayerColor } from '@/utils/sideSelection';
import { BetType } from '@/types/bet';

interface MatchmakingManagerProps {
  defaultGameMode?: string;
  defaultTimeControl?: string;
  defaultSide?: string;
  onError?: (error: string) => void;
  onGameFound?: (gameId: string) => void;
}

export interface MatchmakingManagerHandle {
  startMatchmaking: (mode: string, time: string, playSide: string, betOptions?: {
    betChallengeId?: string;
    betType?: BetType;
    stakeAmount?: number;
    opponentId?: string;
  }) => void;
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
    const [betChallengeId, setBetChallengeId] = useState<string | undefined>(undefined);
    
    // Mock player info - in a real app this would come from auth state
    const playerInfo = {
      username: 'sup1981',
      rating: 1762
    };
    
    const listenersSetupRef = React.useRef(false);
    
    // Expose methods to parent component through ref
    useImperativeHandle(ref, () => ({
      startMatchmaking: (mode: string, time: string, playSide: string, betOptions?: {
        betChallengeId?: string;
        betType?: BetType;
        stakeAmount?: number;
        opponentId?: string;
      }) => {
        startMatchmaking(mode, time, playSide, betOptions);
      }
    }));
    
    useEffect(() => {
      if (listenersSetupRef.current) return; // Prevent duplicate setup
      listenersSetupRef.current = true;
      
      const handleMatchFound = (gameData: any) => {
        console.log('[MatchmakingManager] Match found event received:', gameData);
        
        // Stop matchmaking state
        setIsMatchmaking(false);
        
        // Validate game data
        if (!gameData || !gameData.gameId) {
          console.error('[MatchmakingManager] Invalid game data received:', gameData);
          setError('Invalid game data received from server');
          if (onError) onError('Invalid game data received from server');
          return;
        }
        
        // Store player color in localStorage based on assigned color
        if (gameData.playerColor) {
          console.log(`[MatchmakingManager] Setting player color to: ${gameData.playerColor}`);
          localStorage.setItem('playerColor', gameData.playerColor);
        }
        
        // Store game details in localStorage for potential reconnection
        try {
          // Store timeControl in localStorage
          if (gameData.timeControl) {
            console.log(`[MatchmakingManager] Setting time control to: ${gameData.timeControl}`);
            localStorage.setItem('timeControl', gameData.timeControl);
          } else {
            // Use the current timeControl as fallback
            const fallbackTimeControl = `${timeControl}+0`;
            console.log(`[MatchmakingManager] No time control received, using fallback: ${fallbackTimeControl}`);
            localStorage.setItem('timeControl', fallbackTimeControl);
          }
          
          // Store gameId in localStorage
          localStorage.setItem('currentGameId', gameData.gameId);
          
          // Store gameMode in localStorage if available
          if (gameData.gameMode) {
            localStorage.setItem('gameMode', gameData.gameMode);
          }
        } catch (error) {
          console.warn('[MatchmakingManager] Error storing game details in localStorage:', error);
          // Non-fatal error, continue with navigation
        }
        
        // Navigate to the game screen with the game ID
        console.log(`[MatchmakingManager] Navigating to game: /play/game/${gameData.gameId}`);
        
        // Notify parent component if callback is provided
        if (onGameFound) {
          console.log('[MatchmakingManager] Calling onGameFound callback with gameId:', gameData.gameId);
          onGameFound(gameData.gameId);
        } else {
          console.log('[MatchmakingManager] No onGameFound callback provided, handling navigation internally');
          
          // Use setTimeout to ensure the navigation happens after state updates
          setTimeout(() => {
            console.log(`[MatchmakingManager] Executing navigation to /play/game/${gameData.gameId}`);
            router.push(`/play/game/${gameData.gameId}`);
          }, 100);
        }
      };
      
      const handleMatchmakingError = (error: any) => {
        console.error('[MatchmakingManager] Matchmaking error:', error);
        const errorMessage = error.message || 'An error occurred during matchmaking';
        setError(errorMessage);
        setIsMatchmaking(false);
        
        if (onError) {
          onError(errorMessage);
        }
      };
      
      const handleMatchmakingStatus = (status: any) => {
        console.log('[MatchmakingManager] Matchmaking status update:', status);
      };
      
      const handleConnectionStatus = (status: string, details?: string) => {
        console.log(`[MatchmakingManager] Socket connection status: ${status}${details ? ` (${details})` : ''}`);
        
        // If we're matchmaking and the socket disconnects, show an error
        if (status === 'disconnected' && isMatchmaking) {
          console.error('[MatchmakingManager] Socket disconnected during matchmaking');
          setError('Connection to game server lost. Please try again.');
          setIsMatchmaking(false);
          if (onError) onError('Connection to game server lost. Please try again.');
        }
        
        // If connection fails completely, show an error
        if (status === 'failed' && isMatchmaking) {
          console.error('[MatchmakingManager] Socket connection failed during matchmaking');
          setError('Unable to connect to game server. Please try again later.');
          setIsMatchmaking(false);
          if (onError) onError('Unable to connect to game server. Please try again later.');
        }
      };
      
      // Initialize socket if not already connected
      if (!socketService.isConnected()) {
        console.log('[MatchmakingManager] Initializing socket connection');
        socketService.getSocket();
      }
      
      // Register event listeners
      socketService.onMatchFound(handleMatchFound);
      socketService.onMatchmakingError(handleMatchmakingError);
      socketService.onMatchmakingStatus(handleMatchmakingStatus);
      socketService.onConnectionStatusChange(handleConnectionStatus);
      
      // Clean up listeners when component unmounts
      return () => {
        listenersSetupRef.current = false;
        socketService.offMatchFound(handleMatchFound);
        socketService.offMatchmakingError(handleMatchmakingError);
        socketService.offMatchmakingStatus(handleMatchmakingStatus);
        socketService.offConnectionStatusChange(handleConnectionStatus);
        
        // Cancel matchmaking if component unmounts while matchmaking is active
        if (isMatchmaking) {
          console.log('[MatchmakingManager] Component unmounting while matchmaking is active - cancelling matchmaking');
          socketService.cancelMatchmaking();
        }
      };
    }, [router, isMatchmaking, side, onError, onGameFound, timeControl]);
    
    const startMatchmaking = (
      mode: string, 
      time: string, 
      playSide: string, 
      betOptions?: {
        betChallengeId?: string;
        betType?: BetType;
        stakeAmount?: number;
        opponentId?: string;
      }
    ) => {
      console.log('StartMatchmaking called with:', { mode, time, playSide, betOptions });
      setError(null);
      setIsMatchmaking(true);
      setGameMode(mode);
      setTimeControl(time);
      setSide(playSide);
      
      // Store bet challenge ID if provided
      if (betOptions?.betChallengeId) {
        setBetChallengeId(betOptions.betChallengeId);
      }
      
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
              timeControlString = `${timeValue}+0`;
              effectiveGameMode = 'Rapid';
            }
        }
        
        // Store in localStorage before starting matchmaking
        localStorage.setItem('timeControl', timeControlString);
        localStorage.setItem('gameMode', effectiveGameMode);
        console.log('MatchmakingManager stored timeControl in localStorage:', timeControlString);
        console.log('MatchmakingManager stored gameMode in localStorage:', effectiveGameMode);
        
        // Ensure socket is initialized and connected
        const socket = socketService.getSocket();
        const isConnected = socketService.isConnected();
        console.log('Socket connection status before matchmaking:', isConnected);
        
        // If socket is not connected, try to connect and retry matchmaking
        if (!isConnected) {
          console.log("Socket not connected, attempting to connect...");
          
          // Force socket reconnection
          if (socket) {
            socket.connect();
          }
          
          // Wait for connection and then start matchmaking
          setTimeout(() => {
            const reconnected = socketService.isConnected();
            console.log("Socket connection status after retry:", reconnected);
            
            if (reconnected) {
              console.log("Socket connected after retry, starting matchmaking");
              const options = {
                gameMode: effectiveGameMode,
                timeControl: timeControlString,
                rated: true,
                preferredSide: playSide,
                ...(betOptions?.betChallengeId ? { betChallengeId: betOptions.betChallengeId } : {})
              };
              socketService.startMatchmaking(options);
            } else {
              console.error("Socket connection failed after retry");
              setError("Unable to connect to game server. Please try again.");
              setIsMatchmaking(false);
              if (onError) onError("Unable to connect to game server. Please try again.");
            }
          }, 1500); // Increased timeout to allow more time for connection
        } else {
          // Socket is already connected, start matchmaking immediately
          console.log("Socket already connected, starting matchmaking immediately");
          const options = {
            gameMode: effectiveGameMode,
            timeControl: timeControlString,
            rated: true,
            preferredSide: playSide,
            ...(betOptions?.betChallengeId ? { betChallengeId: betOptions.betChallengeId } : {})
          };
          socketService.startMatchmaking(options);
        }
      } catch (err) {
        console.error('Error in startMatchmaking:', err);
        const errorMessage = err instanceof Error ? err.message : "An error occurred while starting matchmaking";
        setError(errorMessage);
        setIsMatchmaking(false);
        if (onError) onError(errorMessage);
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
          const testCases = [
            { player1: 'white', player2: 'white' },
            { player1: 'white', player2: 'black' },
            { player1: 'white', player2: 'random' },
            { player1: 'black', player2: 'white' },
            { player1: 'black', player2: 'black' },
            { player1: 'black', player2: 'random' },
            { player1: 'random', player2: 'white' },
            { player1: 'random', player2: 'black' },
            { player1: 'random', player2: 'random' },
          ];
          
          console.log('Running side selection test cases:');
          testCases.forEach((testCase, i) => {
            const result = module.determinePlayerColor(
              testCase.player1 as SidePreference,
              testCase.player2 as SidePreference,
              gameId as string
            );
            console.log(`Test ${i+1}: player1=${testCase.player1}, player2=${testCase.player2} => player1 is ${result.player1Color}, player2 is ${result.player2Color}`);
          });
        });
      };
    }
    
    // Invisible component - no UI, just logic
    return null;
  }
);

MatchmakingManager.displayName = 'MatchmakingManager';

export default MatchmakingManager; 