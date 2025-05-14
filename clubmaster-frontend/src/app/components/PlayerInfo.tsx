'use client';

import React from 'react';
import ChessPiece from './ChessPiece';
import { CapturedPiece } from '../utils/types';
import Image from 'next/image';

// Piece values for sorting captured pieces
const pieceValues = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0 // King is not typically captured
};

interface PlayerInfoProps {
  position: 'top' | 'bottom';
  username: string;
  rating?: number; // Optional for guest users
  clubAffiliation?: string; // Optional for guest users
  isGuest: boolean;
  capturedPieces: CapturedPiece[];
  isActive?: boolean; // New prop to indicate if it's this player's turn
}

const PlayerInfo: React.FC<PlayerInfoProps> = ({
  position,
  username,
  rating,
  capturedPieces,
  isActive = false // Default to inactive
}) => {
  // Determine styles based on position (top/bottom)
  const isTop = position === 'top';
  
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
      <div className="flex flex-wrap gap-[1px]">
        {sortedCapturedPieces.map((piece) => (
          <div key={piece.id} className="w-6 h-6">
            <ChessPiece type={piece.type} color={piece.color} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`w-full ${isTop ? 'mt-[21px] mb-3' : 'mt-3 mb-[21px]'} py-1 relative`}>
      <div className="flex items-start justify-between">
        {/* Left section with profile and info */}
        <div className="flex items-start gap-3">
          {/* Profile Icon/Avatar with active indicator */}
          <div className="relative">
            {/* Green dot indicator above profile */}
            {isActive && (
              <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-green-500 animate-pulse z-10"></div>
            )}
            <div className="w-[48px] h-[48px] flex items-center justify-center">
              <Image 
                src={isTop ? "/icons/avatar1.svg" : "/icons/avatar2.svg"}
                alt="Player Avatar"
                width={41}
                height={41}
                className="w-[41px] h-[41px] object-contain"
              />
            </div>
          </div>
          
          {/* Player Info - stacked vertically */}
          <div className="flex flex-col">
            {/* Player name */}
            <h3 className="font-roboto font-[500] text-[16px] tracking-[0.25%] text-[#FAF3DD]">
              {username}
              {rating && <span className="ml-1">({rating})</span>}
            </h3>
            
            {/* Captured Pieces - with 4px gap from name */}
            <div className="mt-[4px]">
              {renderCapturedPieces()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerInfo; 