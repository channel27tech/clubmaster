'use client';

import React from 'react';
import ChessPiece from './ChessPiece';
import { CapturedPiece } from '../utils/types';

// Define the types for a chess piece
type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

interface PlayerInfoProps {
  position: 'top' | 'bottom';
  username: string;
  rating?: number; // Optional for guest users
  clubAffiliation?: string; // Optional for guest users
  isGuest: boolean;
  capturedPieces: CapturedPiece[];
}

// Value mapping for pieces to sort by importance
const pieceValues: Record<PieceType, number> = {
  'pawn': 1,
  'knight': 3,
  'bishop': 3,
  'rook': 5,
  'queen': 9,
  'king': 0 // Kings shouldn't be captured, but including for completeness
};

const PlayerInfo: React.FC<PlayerInfoProps> = ({
  position,
  username,
  rating,
  capturedPieces
}) => {
  // Determine styles based on position (top/bottom)
  const isTop = position === 'top';
  
  // Color scheme based on requirements
  const colors = {
    profile: {
      bg: isTop ? '#E9CB6B' : '#333939',
      pieceColor: isTop ? '#333939' : '#FAF3DD'
    },
    text: {
      name: '#FAF3DD',
    },
    capturedPieces: {
      bg: isTop ? '#C8D5B9' : '#333939'
    }
  };

  // Function to render captured pieces
  const renderCapturedPieces = () => {
    const sortedCapturedPieces = [...capturedPieces].sort((a, b) => {
      // Sort by value (higher value first)
      return pieceValues[b.type] - pieceValues[a.type];
    });
    
    // Remove the "No pieces" message - the area will remain blank until pieces are captured
    if (sortedCapturedPieces.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2 justify-center">
        {sortedCapturedPieces.map((piece) => (
          <div key={piece.id} className="w-6 h-6">
            <ChessPiece type={piece.type} color={piece.color} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`w-full ${isTop ? 'mb-3' : 'mt-3'} py-1 px-1`}>
      <div className="flex items-center justify-between">
        {/* Left section with profile and info */}
        <div className="flex items-center gap-2">
          {/* Profile Icon/Avatar */}
          <div 
            className="w-9 h-9 rounded-sm overflow-hidden">
            <div 
              className="w-full h-full flex  items-center justify-center" 
              style={{ backgroundColor: colors.profile.bg }}
            >
              <span className="font-bold text-sm" style={{ color: colors.profile.pieceColor }}>
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          
          {/* Player Info */}
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-sm ms-1 text-[#FAF3DD]">
                {username}
              </h3>
              {rating && <span className="text-xs text-[#FAF3DD]">({rating})</span>}
            </div>
             {/* Captured Pieces */}
        <div className="min-w-[200px] flex justify-start ms--3">
          <div 
            className=" rounded-sm min-h-[30px] flex items-center justify-center"
          >
            {renderCapturedPieces()}
          </div>
        </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PlayerInfo; 