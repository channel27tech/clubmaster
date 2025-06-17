"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import MoveTracker from "@/app/components/MoveTracker";
import ChessBoardWrapper from "@/app/components/ChessBoardWrapper";
import { useSocket } from "@/context/SocketContext";

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
      if (storedColor === 'white' || storedColor === 'black') {
        setPlayerColor(storedColor);
      } else {
        // Default to white if no color is set
        setPlayerColor('white');
      }
      // Get timeControl
      const storedTimeControl = localStorage.getItem("timeControl");
      // Use helper function to validate and format time control
      const validatedTimeControl = validateTimeControl(storedTimeControl);
      setTimeControl(validatedTimeControl);
      // Game start summary log
      console.log(`[GamePage] Game started: gameId=${gameId}, playerColor=${storedColor || 'white'}, timeControl=${validatedTimeControl}`);
      // Ensure moveHistory is initialized to blank at the beginning of a game
      if (typeof window.localStorage !== 'undefined') {
        const chessState = {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          hasWhiteMoved: false,
          moveHistory: {
            moves: [],
            currentMoveIndex: -1
          }
        };
        window.localStorage.setItem('chess_engine_state', JSON.stringify(chessState));
      }
      // Emit enter_game when the component mounts to get initial game state
      if (socket && gameId) {
        setTimeout(() => {
          if (socket.connected) {
            socket.emit('enter_game', { 
              gameId, 
              requestInitialState: true, 
              timestamp: Date.now() 
            });
          } else {
            setTimeout(() => {
              if (socket.connected) {
                socket.emit('enter_game', { 
                  gameId, 
                  requestInitialState: true, 
                  timestamp: Date.now() 
                });
              } else {
                console.error('[GamePage] Socket still not connected on fallback, cannot emit enter_game.');
              }
            }, 1000);
          }
        }, 200);
      } else {
        if (!socket) console.error('[GamePage] Socket is null in useEffect for enter_game.');
        if (!gameId) console.error('[GamePage] gameId is not available in useEffect for enter_game.');
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