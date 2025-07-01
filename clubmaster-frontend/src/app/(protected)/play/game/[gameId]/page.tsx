"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";
import MoveTracker from "@/app/components/MoveTracker";
import ChessBoardWrapper, { ChessBoardWrapperRef } from "@/app/components/ChessBoardWrapper";
import BetGameWrapper from "@/app/components/BetGameWrapper";
import MoveControls from "@/app/components/MoveControls";
import { useSocket } from "@/context/SocketContext";
import { useBetGame } from "@/context/BetGameContext";

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
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId as string;
  const { socket } = useSocket();
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [timeControl, setTimeControl] = useState<string>('5+0');
  const [displayedSanMoves, setDisplayedSanMoves] = useState<string[]>([]);
  const { setGameResult } = useBetGame();

  // Check if this is a bet game
  const isBetGame = searchParams.get('isBetGame') === 'true';
  const betType = searchParams.get('betType');

  // Track socket connection attempts
  const connectionAttemptRef = useRef(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);

  // Reference to the ChessBoardWrapper component
  const chessBoardRef = useRef<ChessBoardWrapperRef>(null);
  // Add a ref to track the previous move index to prevent unnecessary updates
  const previousMoveIndexRef = useRef<number>(-1);

  const handleSanMoveListUpdate = useCallback((moves: string[]) => {
    console.log(`[GamePage] handleSanMoveListUpdate called. Moves length: ${moves.length}`);
    setDisplayedSanMoves(moves);
    // When moves are updated, set the current move index to the latest move
    // Only update if the moves array has actually changed
    if (moves.length !== displayedSanMoves.length) {
      setCurrentMoveIndex(moves.length - 1);
      previousMoveIndexRef.current = moves.length - 1;
    }
  }, [displayedSanMoves.length]);

  // Handle move click in the MoveTracker
  const handleMoveClick = useCallback((moveIndex: number) => {
    // Only update if the move index has actually changed
    if (moveIndex !== currentMoveIndex && moveIndex !== previousMoveIndexRef.current) {
      setCurrentMoveIndex(moveIndex);
      previousMoveIndexRef.current = moveIndex;
      if (chessBoardRef.current) {
        chessBoardRef.current.jumpToMove(moveIndex);
      }
    }
  }, [currentMoveIndex]);

  // Handler for move index changes from ChessBoardWrapper
  const handleMoveIndexChange = useCallback((newIndex: number) => {
    // Only update if the move index has actually changed
    if (newIndex !== currentMoveIndex && newIndex !== previousMoveIndexRef.current) {
      setCurrentMoveIndex(newIndex);
      previousMoveIndexRef.current = newIndex;
    }
  }, [currentMoveIndex]);

  const handleGameEnd = useCallback((isWinner: boolean, isDraw: boolean) => {
    console.log(`[GamePage] Game ended: Winner: ${isWinner}, Draw: ${isDraw}`);

    // Check if this is a bet game before updating the bet game context
    if (isBetGame && betType) {
      console.log('[GamePage] Updating bet game result:', { isWinner, isDraw });
      setGameResult(isWinner);
    } else {
      console.log('[GamePage] Regular game ended, not updating bet game result');
      // For regular games, we'll let the ChessBoardWrapper handle the redirection
    }
  }, [setGameResult, isBetGame, betType]);

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
    }
  }, [gameId]);

  useEffect(() => {
    // Log game information for debugging
    console.log('[GamePage] Game information:', {
      gameId,
      isBetGame,
      betType,
      playerColor: localStorage.getItem('playerColor'),
      timeControl: localStorage.getItem('timeControl')
    });

    // Debug helper to log all socket events
    if (socket) {
      const originalEmit = socket.emit;
      socket.emit = function (...args) {
        console.log(`[Socket Debug] Emitting event: ${args[0]}`, args[1] || {});
        return originalEmit.apply(this, args);
      };
    }

    // Emit enter_game when the component mounts to get initial game state
    if (socket && gameId) {
      setTimeout(() => {
        if (socket.connected) {
          // Include isBetGame flag in the payload for better tracking
          socket.emit('enter_game', {
            gameId,
            requestInitialState: true,
            timestamp: Date.now(),
            isBetGame: isBetGame ? true : false,
            betType: betType || null
          });

          // Explicitly join game room
          socket.emit('join_game_room', {
            gameId,
            isBetGame: isBetGame ? true : false
          });

          // Log connection attempt
          connectionAttemptRef.current += 1;
          console.log(`[GamePage] Sent enter_game and join_game_room for ${gameId}. Attempt: ${connectionAttemptRef.current}`);
        } else {
          console.warn('[GamePage] Socket not connected, will retry in 1 second');
          setTimeout(() => {
            if (socket.connected) {
              // Include isBetGame flag in the payload for better tracking
              socket.emit('enter_game', {
                gameId,
                requestInitialState: true,
                timestamp: Date.now(),
                isBetGame: isBetGame ? true : false,
                betType: betType || null
              });

              // Explicitly join game room
              socket.emit('join_game_room', {
                gameId,
                isBetGame: isBetGame ? true : false
              });

              // Log connection attempt
              connectionAttemptRef.current += 1;
              console.log(`[GamePage] Sent enter_game and join_game_room for ${gameId}. Attempt: ${connectionAttemptRef.current}`);
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

    return () => {
      // Restore original emit function
      if (socket) {
        const originalEmit = socket.emit;
        socket.emit = originalEmit;
      }
    }
  }, [gameId, socket, isBetGame, betType]);

  return (
    <BetGameWrapper gameId={gameId} onGameEnd={handleGameEnd}>
      <div className="flex flex-col min-h-screen bg-[#4A7C59]">
        <Header />
        <MoveTracker
          moves={displayedSanMoves}
          currentMoveIndex={currentMoveIndex}
          onMoveClick={handleMoveClick}
        />
        <MoveControls
          onBack={() => handleMoveClick(currentMoveIndex - 1)}
          onForward={() => handleMoveClick(currentMoveIndex + 1)}
          canGoBack={currentMoveIndex >= 0}
          canGoForward={currentMoveIndex < displayedSanMoves.length - 1}
          gameId={gameId}
          gameState={{ hasStarted: true, isWhiteTurn: true, hasWhiteMoved: true }}
          moveHistory={{ length: displayedSanMoves.length, currentMoveIndex }}
        />
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="w-full max-w-md mx-auto">
            <ChessBoardWrapper
              ref={chessBoardRef}
              playerColor={playerColor}
              timeControl={timeControl}
              gameId={gameId}
              onSanMoveListChange={handleSanMoveListUpdate}
              onGameEnd={handleGameEnd}
              currentMoveIndex={currentMoveIndex}
              onMoveIndexChange={handleMoveIndexChange}
            />
          </div>
        </div>
      </div>
    </BetGameWrapper>
  );
} 