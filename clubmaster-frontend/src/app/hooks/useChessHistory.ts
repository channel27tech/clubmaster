import { useState, useCallback } from 'react';
import { MoveHistoryState, initializeMoveHistory, goBackOneMove, goForwardOneMove, BoardState, ChessMove } from '../utils/moveHistory';

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
  appendMove: (move: ChessMove) => void;
  
  // Navigation
  goBack: () => void;
  goForward: () => void;
  jumpToMove: (moveIndex: number) => void; // New method to jump to specific move
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
  const appendMove = useCallback((move: ChessMove) => {
    // Create updated move history
    const updatedMoves = [...moveHistory.moves, move];
    
    const newHistory = {
      ...moveHistory,
      moves: updatedMoves,
      currentMoveIndex: updatedMoves.length - 1
    };
    
    // When adding a new move, we're always at the latest position
    setIsViewingHistory(false);
    updateMoveHistory(newHistory);
  }, [moveHistory, updateMoveHistory]);

  // Navigate through history
  const goBack = useCallback(() => {
    // Allow going from move 0 to -1 (initial state)
    if (moveHistory.currentMoveIndex === -1) {
      return;
    }
    const newIndex = moveHistory.currentMoveIndex - 1;
    if (newIndex < -1) return;
    // If going to -1, set board to initial state
    if (newIndex === -1) {
      setMoveHistory({ ...moveHistory, currentMoveIndex: -1 });
      setBoardState({ ...moveHistory.initialBoardState });
      setIsViewingHistory(true);
      setLastMoveState(null);
      if (onMoveHistoryChange) {
        onMoveHistoryChange({ ...moveHistory, currentMoveIndex: -1 });
      }
      return;
    }
    // Otherwise, use goBackOneMove as before
    const { newHistory, boardState: newBoardState } = goBackOneMove(moveHistory);
    setMoveHistory(newHistory);
    setBoardState({ ...newBoardState });
    setIsViewingHistory(true);
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
    
    // If we're at the latest move after going forward, exit history mode
    setIsViewingHistory(newHistory.currentMoveIndex < newHistory.moves.length - 1);
    
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

  // New method to jump directly to a specific move in history
  const jumpToMove = useCallback((moveIndex: number) => {
    if (moveIndex < -1 || moveIndex >= moveHistory.moves.length) {
      console.log(`Invalid move index: ${moveIndex}. Valid range is -1 to ${moveHistory.moves.length - 1}`);
      return;
    }
    
    // If we're already at this move index, don't do anything to prevent unnecessary updates
    if (moveIndex === moveHistory.currentMoveIndex) {
      console.log(`Already at move index ${moveIndex}, no update needed`);
      return;
    }
    
    console.log(`Jumping to move index: ${moveIndex}`);
    
    // If -1, set to initial state
    if (moveIndex === -1) {
      setMoveHistory({ ...moveHistory, currentMoveIndex: -1 });
      setBoardState({ ...moveHistory.initialBoardState });
      setIsViewingHistory(true);
      setLastMoveState(null);
      if (onMoveHistoryChange) {
        onMoveHistoryChange({ ...moveHistory, currentMoveIndex: -1 });
      }
      return;
    }
    
    // Otherwise, jump to the move as before
    const newHistory = {
      ...moveHistory,
      currentMoveIndex: moveIndex
    };
    
    // Calculate the board state at this move
    let newBoardState = {...moveHistory.initialBoardState};
    
    // Apply moves up to the target index
    if (moveIndex >= 0) {
      newBoardState = {...moveHistory.moves[moveIndex].boardState};
    }
    
    // Update the move history
    setMoveHistory(newHistory);
    
    // Update the board state
    setBoardState({...newBoardState});
    
    // Set viewing history mode if not at the latest move
    setIsViewingHistory(moveIndex < moveHistory.moves.length - 1);
    
    // Update the last move highlight
    if (moveIndex >= 0) {
      const selectedMove = moveHistory.moves[moveIndex];
      setLastMoveState({ from: selectedMove.from, to: selectedMove.to });
    } else {
      setLastMoveState(null);
    }
    
    // Notify parent if callback is provided
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // New method to exit history mode and show live game state
  const exitHistoryMode = useCallback((liveBoardState: BoardState) => {
    console.log("[HISTORY] Exiting history mode, returning to live game state");
    
    // Check if we're already at the latest move and not in history mode
    // This prevents unnecessary state updates that can cause flickering
    if (!isViewingHistory && moveHistory.currentMoveIndex === moveHistory.moves.length - 1) {
      console.log("[HISTORY] Already at latest move and not in history mode, no action needed");
      return;
    }
    
    // Update move history to latest move index
    const latestMoveIndex = moveHistory.moves.length - 1;
    
    // First update the isViewingHistory flag to prevent updateBoardState from ignoring our update
    setIsViewingHistory(false);
    
    // Update the history index in a single operation
    setMoveHistory(prev => ({
      ...prev,
      currentMoveIndex: latestMoveIndex,
    }));
    
    // Update board state to live game state
    setBoardState(liveBoardState);
    
    // Update last move to match the latest move
    if (latestMoveIndex >= 0) {
      const latestMove = moveHistory.moves[latestMoveIndex];
      setLastMoveState({ from: latestMove.from, to: latestMove.to });
    } else {
      setLastMoveState(null);
    }
    
    // Notify parent if callback is provided
    if (onMoveHistoryChange) {
      onMoveHistoryChange({
        ...moveHistory,
        currentMoveIndex: latestMoveIndex,
      });
    }
  }, [moveHistory, onMoveHistoryChange, isViewingHistory]);

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
    jumpToMove,
    exitHistoryMode
  };
};

export default useChessHistory; 