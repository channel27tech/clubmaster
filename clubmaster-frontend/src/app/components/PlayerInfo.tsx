'use client';

import React from 'react';
import ChessPiece from './ChessPiece';
import PlayerActivityStatus from '../../components/PlayerActivityStatus';
import { CapturedPiece } from '../utils/types';
import Image from 'next/image';

// Define PieceType type
type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

// Piece values for sorting captured pieces
const pieceValues: { [key in PieceType]: number } = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 0, // King is not typically captured
};

interface PlayerInfoProps {
  position: 'top' | 'bottom';
  username: string;
  userId?: string; // User ID for activity status
  rating?: number; // Optional for guest users
  clubAffiliation?: string; // Optional for guest users
  isGuest: boolean;
  capturedPieces: CapturedPiece[];
  isActive?: boolean; // New prop to indicate if it's this player's turn
  photoURL?: string | null; // Real player photo URL from database
}

const PlayerInfo: React.FC<PlayerInfoProps> = ({
  position,
  username,
  userId,
  rating,
  capturedPieces,
  isActive = false, // Default to inactive
  photoURL = null // Player's photo URL from the database
}) => {
  // Determine styles based on position (top/bottom)
  const isTop = position === 'top';
  
  // Helper function to get the best profile image to display
  const getBestProfileImage = (): string => {
    // Check if photoURL is a base64 string (custom uploaded photo)
    const isBase64Image = photoURL?.startsWith('data:image');
    
    if (photoURL) {
      return photoURL;
    }
    
    // Fallback to default avatar based on position
    return isTop ? "/icons/avatar1.svg" : "/icons/avatar2.svg";
  };
  
  // Helper function to get the best username to display
  const getBestUsername = (): string => {
    // Check if username is valid
    if (username && username !== 'Loading...') {
      return username;
    }
    
    // Fallback to position-based generic name
    return isTop ? "White Player" : "Black Player";
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
            {/* Green dot indicator above profile for turn indicator */}
            {isActive && (
              <div className="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-green-500 animate-pulse z-10"></div>
            )}
            <div className="w-[41px] h-[41px] flex items-center justify-center">
              <div className="w-[41px] h-[41px] overflow-hidden rounded-[4px]">
                <Image 
                  src={getBestProfileImage()}
                  alt={`${username}'s Avatar`}
                  width={41}
                  height={41}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If image fails to load, replace with fallback
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `
                      <div class="w-[41px] h-[41px] flex items-center justify-center bg-[#4A7C59] rounded-[4px] text-white text-lg font-bold">
                        ${username ? username.charAt(0).toUpperCase() : 'P'}
                      </div>
                    `;
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Player Info - stacked vertically */}
          <div className="flex flex-col">
            {/* Player name and rating */}
            <div className="flex items-center gap-2">
              <h3 className="font-roboto font-[500] text-[16px] tracking-[0.25%] text-[#FAF3DD]">
                {getBestUsername()}
                {rating && <span className="ml-1">({rating})</span>}
              </h3>
              
              {/* Activity status */}
              {userId && (
                <PlayerActivityStatus userId={userId} compact={true} />
              )}
            </div>
            
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