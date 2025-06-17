import { useEffect, useRef } from 'react';
import { BoardState } from '../utils/moveHistory';
import { 
  getFen, 
  setChessPosition, 
  resetChessEngine, 
  getCurrentBoardState,
  getChessEngine
} from '../utils/chessEngine';

/**
 * Helper function to fully synchronize the board state from FEN
 */
export const synchronizeBoardFromFen = (fen: string): BoardState => {
  try {
    // Reset the chess engine with the provided FEN
    resetChessEngine();
    const chess = getChessEngine();
    
    // Load the FEN into the chess engine
    chess.load(fen);
    
    // If we got here without an error, the load was successful
    // Get the new board state after successfully loading the FEN
    return getCurrentBoardState();
  } catch (error) {
    console.error('Error synchronizing board from FEN:', error);
    return getCurrentBoardState(); // Return current state as fallback
  }
};

interface UseBoardSyncProps {
  boardState: BoardState;
  intervalMs?: number;
}

interface UseBoardSyncResult {
  currentFen: string | null;
  checkConsistency: () => boolean;
  recoverBoardState: () => void;
}

/**
 * Custom hook to ensure board state consistency and provide recovery mechanisms
 */
const useBoardSync = ({
  boardState,
  intervalMs = 100
}: UseBoardSyncProps): UseBoardSyncResult => {
  // Add a stable reference to the current board state
  const boardStateRef = useRef<{
    fen: string | null;
    boardState: BoardState | null;
  }>({
    fen: null,
    boardState: null
  });
  
  // Update our stable reference whenever the board state changes
  useEffect(() => {
    if (boardState) {
      boardStateRef.current = {
        fen: getFen(),
        boardState: boardState
      };
    }
  }, [boardState]);
  
  // Add a recovery mechanism that runs periodically to ensure board state consistency
  useEffect(() => {
    const checkBoardConsistency = () => {
      if (boardStateRef.current.fen) {
        const currentFen = getFen();
        if (currentFen !== boardStateRef.current.fen && 
            boardState === boardStateRef.current.boardState) {
          setChessPosition(boardStateRef.current.fen);
        }
      }
    };
    
    // Check board consistency at specified interval
    const intervalId = setInterval(checkBoardConsistency, intervalMs);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [boardState, intervalMs]);
  
  // Check if the board is consistent with our reference
  const checkConsistency = () => {
    if (!boardStateRef.current.fen) return true; // No reference to compare against
    
    const currentFen = getFen();
    return currentFen === boardStateRef.current.fen;
  };
  
  // Recover the board state from our reference
  const recoverBoardState = () => {
    if (boardStateRef.current.fen) {
      setChessPosition(boardStateRef.current.fen);
      return true;
    }
    return false;
  };
  
  return {
    currentFen: boardStateRef.current.fen,
    checkConsistency,
    recoverBoardState
  };
};

export default useBoardSync; 