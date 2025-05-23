import { useState, useCallback } from 'react';
import { BoardState, PieceType, PieceColor, generateNotation } from '../utils/moveHistory';
import { makeMove, getChessEngine, getGameStatus, getCurrentBoardState } from '../utils/chessEngine';
import { isPawnPromotion, findMovingPiece } from '../utils/boardHelpers';

interface UseChessMoveProps {
  boardState: BoardState;
  currentPlayer: 'white' | 'black';
  playerColor?: 'white' | 'black' | null;
  onPromotionNeeded: (from: string, to: string, piece: { type: PieceType, color: PieceColor }) => void;
}

interface UseChessMoveResult {
  // State
  selectedSquare: string | null;
  legalMoves: string[];
  
  // Actions
  selectSquare: (position: string, piece: { type: PieceType, color: PieceColor } | null) => void;
  clearSelection: () => void;
  makePlayerMove: (from: string, to: string) => boolean;
  handlePromotion: (from: string, to: string, promotionPiece: PieceType, piece: { type: PieceType, color: PieceColor }) => boolean;
}

/**
 * Custom hook for chess move handling
 */
export const useChessMove = ({
  boardState,
  currentPlayer,
  playerColor,
  onPromotionNeeded
}: UseChessMoveProps): UseChessMoveResult => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  
  // Clear the current selection
  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, []);
  
  // Handle selecting a square on the board
  const selectSquare = useCallback((position: string, piece: { type: PieceType, color: PieceColor } | null) => {
    // If no piece on square, clear selection
    if (!piece) {
      clearSelection();
      return;
    }
    
    // PRIMARY RESTRICTION: Only allow players to select their own color if playerColor is set
    if (playerColor && piece.color !== playerColor) {
      console.log(`Cannot select ${piece.color} pieces when you are ${playerColor}`);
      clearSelection();
      return;
    }
    
    // Only allow selection of pieces that match the current turn
    if (piece.color !== currentPlayer) {
      console.log(`Cannot select ${piece.color} pieces on ${currentPlayer}'s turn`);
      clearSelection();
      return;
    }
    
    // Set the selected square
    setSelectedSquare(position);
    
    // Calculate legal moves for this piece
    try {
      const chess = getChessEngine();
      
      // Use a type assertion to work around the Chess.js typing issues
      // The position is a valid algebraic notation square (e.g. "e4")
      const legalMoves = chess.moves({
        // Fix the type error by using a proper type cast
        square: position as any,
        verbose: true
      });
      
      // Extract the destination squares
      const legalDestinations: string[] = [];
      if (legalMoves && legalMoves.length > 0) {
        for (const move of legalMoves) {
          if (move && move.to) {
            legalDestinations.push(move.to);
          }
        }
      }
      
      setLegalMoves(legalDestinations);
    } catch (err) {
      console.error("Error calculating legal moves:", err);
      setLegalMoves([]);
    }
  }, [clearSelection, currentPlayer, playerColor]);
  
  // Make a regular move (non-promotion)
  const makePlayerMove = useCallback((from: string, to: string): boolean => {
    try {
      // Find the piece that's moving
      const movingPiece = findMovingPiece(from, boardState);
      
      if (!movingPiece) {
        console.error('No piece found at position', from);
        return false;
      }
      
      // Double check the moving piece belongs to current player
      if (movingPiece.color !== currentPlayer) {
        console.log(`Cannot move ${movingPiece.color} pieces on ${currentPlayer}'s turn`);
        return false;
      }
      
      // Check if this move would be a pawn promotion
      if (isPawnPromotion(from, to, movingPiece)) {
        // Defer to promotion handling
        onPromotionNeeded(from, to, movingPiece);
        return true;
      }
      
      // Try to make the move in chess.js
      const moveSuccess = makeMove(from, to);
      
      return moveSuccess;
    } catch (error) {
      console.error('Error making move:', error);
      return false;
    }
  }, [boardState, currentPlayer, onPromotionNeeded]);
  
  // Handle promotion move
  const handlePromotion = useCallback((
    from: string, 
    to: string, 
    promotionPiece: PieceType,
    piece: { type: PieceType, color: PieceColor }
  ): boolean => {
    try {
      // Make the move with promotion
      const moveSuccess = makeMove(from, to, promotionPiece);
      
      return moveSuccess;
    } catch (error) {
      console.error('Error making promotion move:', error);
      return false;
    }
  }, []);
  
  return {
    selectedSquare,
    legalMoves,
    selectSquare,
    clearSelection,
    makePlayerMove,
    handlePromotion
  };
};

export default useChessMove; 