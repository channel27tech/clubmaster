'use client';

import React from 'react';
import ChessPiece from './ChessPiece';
import { PieceType, PieceColor } from '../utils/moveHistory';
import { isSquareDark } from '../utils/boardHelpers';

interface ChessSquareProps {
  position: string;
  piece: { type: PieceType, color: PieceColor } | null;
  row: number;
  col: number;
  isLastMove: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  onClick: (position: string, piece: { type: PieceType, color: PieceColor } | null) => void;
}

/**
 * Component for an individual chess square
 */
const ChessSquare: React.FC<ChessSquareProps> = ({
  position,
  piece,
  row,
  col,
  isLastMove,
  isSelected,
  isLegalMove,
  onClick
}) => {
  // Get the appropriate background color for the square based on its state
  const getSquareBackground = () => {
    const isDark = isSquareDark(row, col);
    
    if (isSelected) {
      return isDark ? 'bg-blue-700' : 'bg-blue-500';
    } else if (isLegalMove) {
      return isDark ? 'bg-green-700' : 'bg-green-500';
    } else if (isLastMove) {
      return isDark ? 'bg-amber-600' : 'bg-amber-400';
    }
    
    return isDark ? 'bg-[#6D8884]' : 'bg-[#FAF3DD]';
  };
  
  // Handle click on this square
  const handleClick = () => {
    onClick(position, piece);
  };

  return (
    <div 
      className={`
        flex items-center justify-center
        ${getSquareBackground()}
        cursor-pointer
      `}
      onClick={handleClick}
    >
      {piece && (
        <ChessPiece
          type={piece.type}
          color={piece.color}
        />
      )}
      {isLegalMove && !piece && (
        <div className="w-3 h-3 rounded-full bg-green-500 opacity-60"></div>
      )}
    </div>
  );
};

export default ChessSquare; 