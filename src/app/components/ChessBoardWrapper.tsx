'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import PlayerInfo from './PlayerInfo';
import MoveControls from './MoveControls';
import GameClock from './GameClock';
import GameResultScreen from './GameResultScreen';
import { MoveHistoryState } from '../utils/moveHistory';
import { getChessEngine, makeMove, resetChessEngine, setChessPosition, getGameStatus, getCurrentBoardState, isThreefoldRepetition, getFen, clearChessState } from '../utils/chessEngine';
import { useSound } from '../../context/SoundContext';
import { useSocket } from '../../context/SocketContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';
import { CapturedPiece, GameResultType, GameEndReason, GameResult, PlayerData } from '../utils/types';
import DisconnectionNotification from './DisconnectionNotification';
import { fetchGamePlayers } from '../api/gameApi';
import { Chess } from 'chess.js';
import { onBetResult, offBetResult } from '@/services/betService';
import { saveBetResult } from '@/services/betResultService';
import { useBet } from '../../context/BetContext';
import { useAuth } from '../../context/AuthContext';
import { BetResult } from '@/types/bet';

// Use dynamic import in a client component
const ChessBoard = dynamic(() => import('./ChessBoard'), {
  ssr: false,
});

// Rest of the imports and component definition...

export default function ChessBoardWrapper({ playerColor, timeControl = '5+0', gameId = '', onSanMoveListChange }: ChessBoardWrapperProps) {
  // All existing state and hooks...

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    
    const safeSocket = socket;
    
    // Keep track of last established turn state with timestamps
    // This helps prevent issues when other WebSocket operations like sound settings occur
    const gameStateTracker = {
      isWhiteTurn: true,
      hasStarted: false,
      lastUpdateTime: Date.now(),
      // Store player turn by color for reliable referencing
      activePlayer: 'white' as 'white' | 'black' | null,
      // Store a reference to the active interval to prevent duplicates
      stateCheckInterval: null as NodeJS.Timeout | null
    };

    // Listen for draw offers
    // ... existing draw offer code ...

    // Game events that would update the game state
    // ... existing game_started event code ...

    // Listen for move_made events from the server
    safeSocket.on('move_made', ({ player, isCapture, isCheck, from, to, san, notation, fen, moveId }) => {
      console.log(`[SERVER EVENT] Received move_made broadcast - player: ${player}, from: ${from}, to: ${to}`);
      
      // CRITICAL: Do NOT add this server-broadcast move to the moveQueue
      // Instead, directly apply it to our local chess engine
      
      try {
        const chess = getChessEngine();
        
        // If we have a FEN, use it for full synchronization (most reliable)
        if (fen) {
          console.log(`[SYNC] Using server-provided FEN for synchronization: ${fen}`);
          chess.load(fen);
        }
        // Otherwise try SAN notation
        else if (san) {
          chess.move(san);
        } 
        // Last resort: use from/to coordinates
        else if (from && to) {
          chess.move({
            from: from,
            to: to,
            promotion: 'q' // Default to queen for now
          });
        }
        
        // Get the updated board state after applying the move
        const newBoardState = getCurrentBoardState();
        setBoardState(newBoardState);
        
        // Update move history from the chess engine (source of truth)
        const engineMoveHistory = chess.history();
        setSanMoveList(engineMoveHistory);
        if (onSanMoveListChange) onSanMoveListChange(engineMoveHistory);
        
        // Update last move for highlighting
        if (from && to) {
          setLastMove({ from, to });
        }
        
        console.log(`[SYNC] Applied move from server. New FEN: ${chess.fen()}`);
        console.log(`[SYNC] Move history length: ${engineMoveHistory.length}`);
        
        // Update turn state based on the player who just moved
        if (player === 'white') {
          setGameState(prev => ({ 
            ...prev, 
            isWhiteTurn: false,
            hasWhiteMoved: true,
            lastMoveBy: 'white'
          }));
          
          // Also ensure activePlayer state is synchronized
          setActivePlayer('black');
        } else {
          setGameState(prev => ({ 
            ...prev, 
            isWhiteTurn: true,
            lastMoveBy: 'black',
            hasWhiteMoved: true // Always mark hasWhiteMoved as true after any move
          }));
          
          // Also ensure activePlayer state is synchronized
          setActivePlayer('white');
        }
        
        // Then play sounds if enabled
        if (soundEnabledRef.current) {
          if (isCheck) {
            playSound('CHECK', true);
          } else if (isCapture) {
            playSound('CAPTURE', true);
          } else {
            playSound('MOVE', true);
          }
        }
      } catch (error) {
        console.error('[ERROR] Failed to apply move from server broadcast:', error);
        // Request a board sync if we failed to apply the move
        if (socket && gameRoomId) {
          console.log('[SYNC] Requesting board sync due to move application failure');
          socket.emit('request_board_sync', {
            gameId: gameRoomId,
            reason: 'move_application_failed',
            clientState: getChessEngine().fen()
          });
        }
      }
    });

    // ... existing event handlers (checkmate, draw, game_end, etc.) ...

    return () => {
      // ... existing cleanup code ...
      safeSocket.off('move_made');
      // ... rest of the cleanup code ...
    };
  }, [socket, gameRoomId, playSound]);

  // Dedicated effect for handling the move queue
  useEffect(() => {
    if (!socket || !moveQueue.length || !gameRoomId) return;

    const move = moveQueue[0];
    const currentSocket = socket; // Capture current socket to avoid closure issues

    // Only send the move to the server, do not apply it locally again
    // (it's already been applied by the local move handler in ChessBoard.tsx)
    const sendMoveToServer = () => {
      try {
        console.log(`[OUTGOING] Sending move to server: ${move.from} to ${move.to}`);
        
        // Use the player color stored with the move
        const currentPlayerColor = move.player;
        
        if (!currentPlayerColor) {
          console.error('[ERROR] No player color specified with move');
          setMoveQueue(prev => prev.slice(1));
          return;
        }

        // Get the current chess engine instance
        const chess = getChessEngine();
        const currentFen = chess.fen();
        const moveHistory = sanMoveList;

        // Create a unique move ID for tracking
        const moveId = `${move.from}-${move.to}-${Date.now()}`;

        // Emit the move_made event
        currentSocket.emit('move_made', {
          gameId: gameRoomId,
          moveId,
          from: move.from,
          to: move.to,
          player: currentPlayerColor,
          promotion: move.promotion,
          currentFen: currentFen,
          moveHistory: moveHistory
        });

        // Set up a timeout to handle case where server doesn't respond
        const timeoutId = setTimeout(() => {
          console.warn(`[TIMEOUT] No server confirmation for move ${moveId} after 5s`);
          // Remove the move from the queue and request board sync
          setMoveQueue(prev => prev.slice(1));
          currentSocket.emit('request_board_sync', {
            gameId: gameRoomId,
            reason: 'move_confirmation_timeout',
            clientState: getChessEngine().fen()
          });
        }, 5000);

        // Set up one-time listener for move confirmation
        const handleMoveConfirmed = (data: { moveId: string, success: boolean }) => {
          if (data.moveId === moveId) {
            clearTimeout(timeoutId);
            currentSocket.off('move_confirmed', handleMoveConfirmed);
            
            if (data.success) {
              console.log(`[CONFIRMED] Move ${moveId} confirmed by server`);
              setMoveQueue(prev => prev.slice(1));
            } else {
              console.error(`[REJECTED] Move ${moveId} rejected by server`);
              // Request board sync to get back in sync
              currentSocket.emit('request_board_sync', {
                gameId: gameRoomId,
                reason: 'move_rejected',
                clientState: getChessEngine().fen()
              });
              setMoveQueue([]); // Clear the queue since we're out of sync
            }
          }
        };

        currentSocket.on('move_confirmed', handleMoveConfirmed);
      } catch (error) {
        console.error('[ERROR] Error sending move to server:', error);
        // Remove the move from the queue on error
        setMoveQueue(prev => prev.slice(1));
      }
    };

    // Send the move to the server
    sendMoveToServer();
  }, [socket, moveQueue, gameRoomId, sanMoveList]);

  // Listen for add_move_to_queue events from the useChessMultiplayer hook
  useEffect(() => {
    // Define the handler for the add_move_to_queue event
    const handleAddMoveToQueue = (event: CustomEvent) => {
      const moveData = event.detail;
      console.log('[EVENT] Received add_move_to_queue event:', moveData);
      
      // Validate that the move has all required fields
      if (!moveData.from || !moveData.to || !moveData.player) {
        console.error('[ERROR] Invalid move data received:', moveData);
        return;
      }
      
      // Add the move to the moveQueue
      setMoveQueue(prev => [...prev, {
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion,
        player: moveData.player
      }]);
    };
    
    // Add the event listener
    window.addEventListener('add_move_to_queue', handleAddMoveToQueue as EventListener);
    
    // Clean up when component unmounts
    return () => {
      window.removeEventListener('add_move_to_queue', handleAddMoveToQueue as EventListener);
    };
  }, []);

  // Rest of the component...
} 