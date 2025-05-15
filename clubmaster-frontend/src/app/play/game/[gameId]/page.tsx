"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import MoveTracker from "@/app/components/MoveTracker";
import ChessBoardWrapper from "@/app/components/ChessBoardWrapper";
import { useSocket } from "@/contexts/SocketContext";

// Helper function to validate and format time control
const validateTimeControl = (timeControlStr: string | null): string => {
  if (!timeControlStr) {
    console.warn('[GamePage] No time control provided, defaulting to 5+0');
    return '5+0';
  }

  try {
    // Extract minutes from the time control string (e.g., "3+0" -> 3)
    const minutes = parseInt(timeControlStr.split('+')[0]);
    
    // Validate known time controls
    if (minutes === 3) return '3+0';  // Bullet
    if (minutes === 5) return '5+0';  // Blitz
    if (minutes === 10) return '10+0'; // Rapid
    
    // For any other valid number, format it properly
    if (!isNaN(minutes) && minutes > 0) {
      return `${minutes}+0`;
    }
    
    console.warn('[GamePage] Invalid time control format, defaulting to 5+0');
    return '5+0';
  } catch (error) {
    console.error('[GamePage] Error validating time control:', error);
    return '5+0';
  }
};

export default function GamePage() {
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [timeControl, setTimeControl] = useState<string>('5+0');
  const { socket } = useSocket();
  const [displayedSanMoves, setDisplayedSanMoves] = useState<string[]>([]);

  const handleSanMoveListUpdate = useCallback((moves: string[]) => {
    console.log(`[GamePage] handleSanMoveListUpdate called. Moves length: ${moves.length}`);
    setDisplayedSanMoves(moves);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Get playerColor
      const storedColor = localStorage.getItem("playerColor");
      // Only set valid values
      if (storedColor === 'white' || storedColor === 'black') {
        setPlayerColor(storedColor);
        console.log(`🎮 Player color set to: ${storedColor} (White always starts first)`);
      } else {
        console.warn('No valid player color found in localStorage, defaulting to white');
        // Default to white if no color is set (should not happen with side selection logic)
        setPlayerColor('white');
      }
      
      // Get timeControl
      const storedTimeControl = localStorage.getItem("timeControl");
      console.log('🔍 Retrieved from localStorage - timeControl:', storedTimeControl);
      
      // Use helper function to validate and format time control
      const validatedTimeControl = validateTimeControl(storedTimeControl);
      setTimeControl(validatedTimeControl);
      console.log(`✅ Using time control: ${validatedTimeControl}`);
      
      // Also log any gameMode that might be stored
      const storedGameMode = localStorage.getItem("gameMode");
      console.log('🔍 Retrieved from localStorage - gameMode:', storedGameMode);

      console.log(`🎮 Game page loaded with gameId: ${gameId}`);
      console.log(`👤 Player: ${storedColor}, ⏱️ Time control: ${validatedTimeControl}`);
      
      // Ensure moveHistory is initialized to blank at the beginning of a game
      if (typeof window.localStorage !== 'undefined') {
        // Reset move history for a fresh game
        const chessState = {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          hasWhiteMoved: false,
          moveHistory: {
            moves: [],
            currentMoveIndex: -1
          }
        };
        window.localStorage.setItem('chess_engine_state', JSON.stringify(chessState));
        console.log('[GamePage] Initialized chess_engine_state in localStorage.');
      }
      
      // Emit enter_game when the component mounts to get initial game state
      if (socket && gameId) {
        console.log(`[GamePage] useEffect for enter_game: Socket ID: ${socket.id}, Connected: ${socket.connected}, Game ID: ${gameId}`);
        setTimeout(() => {
          console.log(`[GamePage] First attempt to emit enter_game: Socket ID: ${socket.id}, Connected: ${socket.connected}, Game ID: ${gameId}`);
          if (socket.connected) {
            socket.emit('enter_game', { 
              gameId, 
              requestInitialState: true, 
              timestamp: Date.now() 
            });
            console.log('[GamePage] enter_game emitted (first attempt).');
          } else {
            console.warn('[GamePage] Socket not connected on first attempt, setting fallback.');
            setTimeout(() => {
              console.log(`[GamePage] Fallback attempt to emit enter_game: Socket ID: ${socket.id}, Connected: ${socket.connected}, Game ID: ${gameId}`);
              if (socket.connected) {
                socket.emit('enter_game', { 
                  gameId, 
                  requestInitialState: true, 
                  timestamp: Date.now() 
                });
                console.log('[GamePage] enter_game emitted (fallback attempt).');
              } else {
                console.error('[GamePage] Socket still not connected on fallback, cannot emit enter_game.');
              }
            }, 1000);
          }
        }, 200);
      } else {
        if (!socket) console.warn('[GamePage] Socket is null in useEffect for enter_game.');
        if (!gameId) console.warn('[GamePage] gameId is not available in useEffect for enter_game.');
      }
    }
  }, [gameId, socket]);

  return (
    <div className="flex flex-col min-h-screen bg-[#4A7C59]">
      <Header />
      <MoveTracker moves={displayedSanMoves} />
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <ChessBoardWrapper 
            playerColor={playerColor} 
            timeControl={timeControl}
            gameId={gameId}
            onSanMoveListChange={handleSanMoveListUpdate}
          />
        </div>
      </div>
    </div>
  );
} 