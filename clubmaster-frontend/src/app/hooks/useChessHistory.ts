import { useState, useCallback } from 'react';
import { MoveHistoryState, initializeMoveHistory, goBackOneMove, goForwardOneMove, BoardState } from '../utils/moveHistory';

export interface UseChessHistoryProps {
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
}

export interface UseChessHistoryResult {
  // State
  moveHistory: MoveHistoryState;
  boardState: BoardState;
  lastMove: { from: string, to: string } | null;
  isViewingHistory: boolean; // New flag to track if user is viewing history
  
  // Actions
  updateMoveHistory: (newMoveHistory: MoveHistoryState) => void;
  updateBoardState: (newBoardState: BoardState) => void;
  setLastMove: (move: { from: string, to: string } | null) => void;
  appendMove: (move: any) => void;   // Simplified for now, will be typed properly later
  
  // Navigation
  goBack: () => void;
  goForward: () => void;
  exitHistoryMode: (liveBoardState: BoardState) => void; // New method to return to live game
}

/**
 * Custom hook to manage chess move history
 */
export const useChessHistory = (
  props?: UseChessHistoryProps | ((moveHistory: MoveHistoryState) => void)
): UseChessHistoryResult => {
  // Handle both old and new calling conventions
  const onMoveHistoryChange = typeof props === 'function' ? props : props?.onMoveHistoryChange;
  // Initialize state
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState>(() => initializeMoveHistory());
  const [boardState, setBoardState] = useState<BoardState>(moveHistory.initialBoardState);
  const [lastMove, setLastMoveState] = useState<{ from: string, to: string } | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState<boolean>(false); // New state

  // Update handlers
  const updateMoveHistory = useCallback((newMoveHistory: MoveHistoryState) => {
    setMoveHistory(newMoveHistory);
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newMoveHistory);
    }
  }, [onMoveHistoryChange]);

  const updateBoardState = useCallback((newBoardState: BoardState) => {
    // Only update board state if not viewing history
    if (!isViewingHistory) {
      console.log("[BOARD UPDATE] Setting new board state");
      setBoardState(newBoardState);
    } else {
      console.log("[BOARD UPDATE] Ignored - currently viewing history");
    }
  }, [isViewingHistory]);

  const setLastMove = useCallback((move: { from: string, to: string } | null) => {
    setLastMoveState(move);
  }, []);

  // Simple append move function (to be expanded)
  const appendMove = useCallback((move: any) => {
    // Create updated move history
    const updatedMoves = [...moveHistory.moves, move];
    
    const newHistory = {
      ...moveHistory,
      moves: updatedMoves,
      currentMoveIndex: updatedMoves.length - 1
    };
    
    updateMoveHistory(newHistory);
  }, [moveHistory, updateMoveHistory]);

  // Navigate through history
  const goBack = useCallback(() => {
    if (moveHistory.currentMoveIndex < 0) {
      console.log("Already at initial position, can't go back further");
      return;
    }
    
    console.log("Going back from move", moveHistory.currentMoveIndex);
    const { newHistory, boardState: newBoardState } = goBackOneMove(moveHistory);
    
    // Update the move history
    setMoveHistory(newHistory);
    
    // Important: Update the board state to match the historical position
    // Force a re-render by creating a new object reference
    setBoardState({...newBoardState});
    setIsViewingHistory(true); // Set viewing history mode
    console.log("Board state updated to historical position", newHistory.currentMoveIndex);
    
    // Update the last move highlight
    const prevMoveIndex = newHistory.currentMoveIndex;
    if (prevMoveIndex >= 0) {
      const prevMove = newHistory.moves[prevMoveIndex];
      setLastMoveState({ from: prevMove.from, to: prevMove.to });
    } else {
      setLastMoveState(null);
    }
    
    // Notify parent if callback is provided
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  const goForward = useCallback(() => {
    if (moveHistory.currentMoveIndex >= moveHistory.moves.length - 1) {
      console.log("Already at latest move, can't go forward");
      return;
    }
    
    console.log("Going forward from move", moveHistory.currentMoveIndex);
    const { newHistory, boardState: newBoardState } = goForwardOneMove(moveHistory);
    
    // Update the move history
    setMoveHistory(newHistory);
    
    // Important: Update the board state to match the historical position
    // Force a re-render by creating a new object reference
    setBoardState({...newBoardState});
    setIsViewingHistory(true); // Keep viewing history mode
    console.log("Board state updated to historical position", newHistory.currentMoveIndex);
    
    // Update the last move highlight
    const nextMoveIndex = newHistory.currentMoveIndex;
    if (nextMoveIndex >= 0) {
      const nextMove = newHistory.moves[nextMoveIndex];
      setLastMoveState({ from: nextMove.from, to: nextMove.to });
    }
    
    // Notify parent if callback is provided
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // New method to exit history mode and show live game state
  const exitHistoryMode = useCallback((liveBoardState: BoardState) => {
    console.log("[HISTORY] Exiting history mode, returning to live game state");
    setIsViewingHistory(false);
    
    // Update move history to latest move index
    setMoveHistory(prev => ({
      ...prev,
      currentMoveIndex: prev.moves.length - 1,
    }));
    
    // Update board state to live game state
    setBoardState(liveBoardState);
    
    // Update last move to match the latest move
    const lastMoveIndex = moveHistory.moves.length - 1;
    if (lastMoveIndex >= 0) {
      const latestMove = moveHistory.moves[lastMoveIndex];
      setLastMoveState({ from: latestMove.from, to: latestMove.to });
    } else {
      setLastMoveState(null);
    }
    
    // Notify parent if callback is provided
    if (onMoveHistoryChange) {
      onMoveHistoryChange({
        ...moveHistory,
        currentMoveIndex: moveHistory.moves.length - 1,
      });
    }
  }, [moveHistory, onMoveHistoryChange]);

  return {
    moveHistory,
    boardState,
    lastMove,
    isViewingHistory,
    updateMoveHistory,
    updateBoardState,
    setLastMove,
    appendMove,
    goBack,
    goForward,
    exitHistoryMode
  };
};

export default useChessHistory; 