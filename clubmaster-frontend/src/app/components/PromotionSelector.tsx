'use client';

import { useCallback } from 'react';
import ChessPiece from './ChessPiece';
import { PieceType, PieceColor } from '../utils/types';

interface PromotionSelectorProps {
  color: PieceColor;
  onSelect: (pieceType: PieceType) => void;
  position: { x: number, y: number };
}

const PromotionSelector = ({ color, onSelect, position }: PromotionSelectorProps) => {
  // Promotion pieces - queens, rooks, bishops, and knights
  const promotionPieces: Array<{type: PieceType, label: string}> = [
    { type: 'queen', label: 'Queen' },
    { type: 'rook', label: 'Rook' },
    { type: 'bishop', label: 'Bishop' },
    { type: 'knight', label: 'Knight' }
  ];
  
  const handleSelect = useCallback((piece: PieceType) => {
    onSelect(piece);
  }, [onSelect]);

  return (
    <div 
      className="absolute z-50 inset-0 flex items-center justify-center pointer-events-none"
    >
      <div 
        className="bg-white shadow-xl border-2 border-gray-800 rounded-md overflow-hidden pointer-events-auto grid grid-cols-2 gap-1 p-2"
        style={{
          maxWidth: '220px'
        }}
      >
        {promotionPieces.map(({ type, label }) => (
          <div 
            key={type}
            className="flex flex-col items-center p-3 hover:bg-blue-100 cursor-pointer rounded-md transition-colors duration-200"
            onClick={() => handleSelect(type)}
            title={`Promote to ${label}`}
          >
            <div className="w-14 h-14 flex items-center justify-center">
              <ChessPiece type={type} color={color} large={true} />
            </div>
            <span className="mt-1 text-sm font-medium text-gray-800">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromotionSelector; 