import { useState, useCallback, RefObject } from 'react';
import { PieceType, PieceColor } from '../utils/moveHistory';
import { calculatePromotionPosition } from '../utils/boardHelpers';

// Define the promotion move type
export interface PromotionMove {
  from: string;
  to: string;
  piece: { type: PieceType, color: PieceColor };
  position: { x: number, y: number };
}

interface UseChessPromotionResult {
  // State
  showPromotion: boolean;
  promotionMove: PromotionMove | null;
  
  // Actions
  setPromotionMove: (move: PromotionMove | null) => void;
  showPromotionSelector: (from: string, to: string, piece: { type: PieceType, color: PieceColor }, boardRef: RefObject<HTMLDivElement>, perspective: 'white' | 'black') => void;
  hidePromotionSelector: () => void;
}

/**
 * Custom hook for managing pawn promotion in chess
 */
export const useChessPromotion = (): UseChessPromotionResult => {
  // Promotion state
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionMove, setPromotionMoveState] = useState<PromotionMove | null>(null);
  
  // Set promotion move directly
  const setPromotionMove = useCallback((move: PromotionMove | null) => {
    setPromotionMoveState(move);
  }, []);
  
  // Show promotion selector
  const showPromotionSelector = useCallback((
    from: string, 
    to: string, 
    piece: { type: PieceType, color: PieceColor },
    boardRef: RefObject<HTMLDivElement>,
    perspective: 'white' | 'black'
  ) => {
    const position = calculatePromotionPosition(to, boardRef, perspective);
    
    setPromotionMoveState({
      from,
      to,
      piece,
      position
    });
    
    setShowPromotion(true);
  }, []);
  
  // Hide promotion selector
  const hidePromotionSelector = useCallback(() => {
    setShowPromotion(false);
    setPromotionMoveState(null);
  }, []);
  
  return {
    showPromotion,
    promotionMove,
    setPromotionMove,
    showPromotionSelector,
    hidePromotionSelector
  };
};

export default useChessPromotion; 