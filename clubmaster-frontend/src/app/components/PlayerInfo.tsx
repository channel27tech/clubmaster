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

    // Group pieces by type for more compact display
    const groupedPieces: Record<PieceType, number> = {
      'queen': 0,
      'rook': 0,
      'bishop': 0,
      'knight': 0,
      'pawn': 0,
      'king': 0
    };

    sortedCapturedPieces.forEach(piece => {
      groupedPieces[piece.type]++;
    });

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(groupedPieces).map(([type, count]) => {
          if (count === 0) return null;
          
          const pieceType = type as PieceType;
          const pieceColor = sortedCapturedPieces[0].color; // All pieces have the same color
          
          return (
            <div key={type} className="flex items-center">
              <div className="w-5 h-5">
                <ChessPiece type={pieceType} color={pieceColor} />
              </div>
              {count > 1 && (
                <span className="text-xs font-semibold text-gray-200 ml-0.5 mr-1">
                  ×{count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex items-center">
      {/* Avatar on the left */}
      <div className="w-9 h-9 rounded-sm overflow-hidden mr-3">
        <div 
          className="w-full h-full flex items-center justify-center" 
          style={{ backgroundColor: colors.profile.bg }}
        >
          <span className="font-bold text-sm" style={{ color: colors.profile.pieceColor }}>
            {username.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
      
      {/* Player name and captured pieces in a column */}
      <div className="flex flex-col justify-center">
        {/* Player name and rating */}
        <div className="flex items-center">
          <h3 className="font-bold text-sm text-[#FAF3DD]">
            {username}
          </h3>
          {rating && <span className="text-xs text-[#FAF3DD] ml-1">({rating})</span>}
        </div>
        
        {/* Captured pieces */}
        <div className="mt-0.5">
          {renderCapturedPieces()}
        </div>
      </div>
    </div>
  );
};

export default PlayerInfo; 