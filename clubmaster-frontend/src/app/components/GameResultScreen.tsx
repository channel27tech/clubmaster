'use client';
import React from 'react';
import { GameResultType, GameEndReason, GameResult } from '../utils/types';

interface GameResultScreenProps extends Omit<GameResult, 'result' | 'reason'> {
  result: GameResultType;
  reason: GameEndReason;
  onClose: () => void;
}

const GameResultScreen: React.FC<GameResultScreenProps> = ({
  result,
  reason,
  playerName,
  opponentName,
  playerRating,
  opponentRating,
  playerRatingChange,
  opponentRatingChange,
  onClose
}) => {
  // Get title text based on result
  const getTitleText = (): string => {
    if (result === 'win') return 'Congratulations!';
    if (result === 'loss') return 'Better luck next time';
    return 'Game Drawn';
  };

  // Get secondary text based on result
  const getSecondaryText = (): string => {
    if (result === 'win') return 'YOU WON';
    if (result === 'loss') return 'YOU LOST';
    return 'DRAW';
  };

  // Get color for the result header
  const getResultColor = (): string => {
    if (result === 'win') return 'bg-[#4A7C59]'; // Green for win
    if (result === 'loss') return 'bg-[#C25450]'; // Red for loss
    return 'bg-[#8A9199]'; // Gray for draw
  };

  // Get rating display
  const getRatingDisplay = (): { rating: number, change: number } => {
    if (result === 'win') {
      return { rating: playerRating, change: playerRatingChange };
    } else if (result === 'loss') {
      return { rating: opponentRating, change: opponentRatingChange };
    } else {
      // For a draw, show player's rating by default
      return { rating: playerRating, change: playerRatingChange };
    }
  };

  const ratingInfo = getRatingDisplay();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[6px]"></div>
      
      {/* Modal content */}
      <div className="relative z-10 bg-[#333939] rounded-lg shadow-xl overflow-hidden w-full max-w-[388px]">
        {/* Curved header with proper spacing */}
        <div className="relative flex justify-center">
          {/* Background color div with curved bottom edges */}
          <div className={`absolute top-0 left-8 right-8 h-20 ${getResultColor()} rounded-b-[90px]`}></div>
          
          {/* Content positioned over the background */}
          <div className="relative z-10 px-4 py-4 flex flex-col items-center">
            <h2 className="text-white text-lg font-bold mb-1">{getTitleText()}</h2>
            <p className="text-[#E9CB6B] text-base font-semibold">{getSecondaryText()}</p>
          </div>
        </div>

        {/* Players information - adjusted for spacing after header */}
        <div className="p-4 pt-10">
          {/* Game result with player profiles */}
          <div className="flex justify-between items-center mb-4">
            {/* Player (You) */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 flex items-center justify-center bg-[#4A7C59] rounded-lg text-white text-lg font-bold mb-2 border-2 border-[#F9F3DD]">
                {playerName.charAt(0).toUpperCase()}
              </div>
              <p className="text-[#F9F3DD] text-sm font-semibold">{playerName}</p>
            </div>

            {/* Score */}
            <div className="text-2xl font-bold text-[#F9F3DD] mx-3">
              {result === 'win' ? '1 - 0' : (result === 'loss' ? '0 - 1' : '½ - ½')}
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 flex items-center justify-center bg-[#333939] rounded-lg text-white text-lg font-bold mb-2 border-2 border-[#F9F3DD]">
                {opponentName.charAt(0).toUpperCase()}
              </div>
              <p className="text-[#F9F3DD] text-sm font-semibold">{opponentName}</p>
            </div>
          </div>

          {/* Rating information - only showing the player's rating + change for winner */}
          <div className="flex justify-center items-center mb-4">
            <span className="text-[#F9F3DD] text-sm mr-2">RATING:</span>
            <span className="text-[#F9F3DD] text-sm font-semibold">
              {ratingInfo.rating}
            </span>
            <span className={`text-sm ${ratingInfo.change >= 0 ? 'text-green-500' : 'text-red-500'} font-bold ml-1`}>
              {ratingInfo.change >= 0 ? `+${ratingInfo.change}` : ratingInfo.change}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4">
          {/* Rematch button (primary) */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#3D563B] transition-colors mb-3 font-medium"
          >
            Rematch
          </button>
          
          {/* Two action buttons in a row */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              className="py-3 border border-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#333939] transition-colors font-medium"
            >
              Share
            </button>
            <button
              onClick={onClose}
              className="py-3 border border-[#4A7C59] text-[#F9F3DD] text-base rounded-md hover:bg-[#333939] transition-colors font-medium"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameResultScreen; 