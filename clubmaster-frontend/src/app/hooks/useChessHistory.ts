import { useState, useCallback } from 'react';
import { MoveHistoryState, initializeMoveHistory, goBackOneMove, goForwardOneMove, BoardState } from '../utils/moveHistory';

interface UseChessHistoryResult {
  // State
  moveHistory: MoveHistoryState;
  boardState: BoardState;
  lastMove: { from: string, to: string } | null;
  
  // Actions
  updateMoveHistory: (newMoveHistory: MoveHistoryState) => void;
  updateBoardState: (newBoardState: BoardState) => void;
  setLastMove: (move: { from: string, to: string } | null) => void;
  appendMove: (move: any) => void;   // Simplified for now, will be typed properly later
  
  // Navigation
  goBack: () => void;
  goForward: () => void;
}

/**
 * Custom hook to manage chess move history
 */
export const useChessHistory = (
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void
): UseChessHistoryResult => {
  // Initialize state
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState>(() => initializeMoveHistory());
  const [boardState, setBoardState] = useState<BoardState>(moveHistory.initialBoardState);
  const [lastMove, setLastMoveState] = useState<{ from: string, to: string } | null>(null);

  // Update handlers
  const updateMoveHistory = useCallback((newMoveHistory: MoveHistoryState) => {
    setMoveHistory(newMoveHistory);
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newMoveHistory);
    }
  }, [onMoveHistoryChange]);

  const updateBoardState = useCallback((newBoardState: BoardState) => {
    setBoardState(newBoardState);
  }, []);

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
    const { newHistory, boardState: newBoardState } = goBackOneMove(moveHistory);
    
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const prevMoveIndex = newHistory.currentMoveIndex;
    if (prevMoveIndex >= 0) {
      const prevMove = newHistory.moves[prevMoveIndex];
      setLastMoveState({ from: prevMove.from, to: prevMove.to });
    } else {
      setLastMoveState(null);
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  const goForward = useCallback(() => {
    const { newHistory, boardState: newBoardState } = goForwardOneMove(moveHistory);
    
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const nextMoveIndex = newHistory.currentMoveIndex;
    if (nextMoveIndex >= 0) {
      const nextMove = newHistory.moves[nextMoveIndex];
      setLastMoveState({ from: nextMove.from, to: nextMove.to });
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  return {
    moveHistory,
    boardState,
    lastMove,
    updateMoveHistory,
    updateBoardState,
    setLastMove,
    appendMove,
    goBack,
    goForward
  };
};

export default useChessHistory; 