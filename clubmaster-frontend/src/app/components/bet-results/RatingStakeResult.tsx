'use client';
import React from 'react';
import BetResultScreen from './BetResultScreen';
import { BetType } from '@/types/bet';

interface RatingStakeResultProps {
  result: 'win' | 'loss' | 'draw';
  playerName: string;
  opponentName: string;
  playerRating: number;
  ratingChange: number;
  playerAvatar: string | null;
  opponentAvatar: string | null;
  opponentId: string;
  stakeAmount?: number;
  onRematch?: () => void;
}

const RatingStakeResult: React.FC<RatingStakeResultProps> = ({
  result,
  playerName,
  opponentName,
  playerRating,
  ratingChange,
  playerAvatar,
  opponentAvatar,
  opponentId,
  stakeAmount = 10,
  onRematch
}) => {
  const isWinner = result === 'win';
  
  return (
    <BetResultScreen
      result={result}
      betType={BetType.RATING_STAKE}
      playerName={playerName}
      opponentName={opponentName}
      playerRating={playerRating}
      ratingChange={ratingChange}
      playerAvatar={playerAvatar}
      opponentAvatar={opponentAvatar}
      opponentId={opponentId}
      onRematch={onRematch}
    >
      <div className="bg-gray-700 rounded-lg p-4 w-full text-center my-4">
        <h3 className="text-xl font-semibold text-white mb-2">
          {isWinner ? 'Rating Gained!' : 'Rating Lost!'}
        </h3>
        <p className="text-gray-200">
          {isWinner 
            ? `You won ${stakeAmount} rating points from ${opponentName}` 
            : `You lost ${stakeAmount} rating points to ${opponentName}`}
        </p>
        <p className="text-gray-300 text-sm mt-2">
          Your new rating is {playerRating}
        </p>
      </div>
    </BetResultScreen>
  );
};

export default RatingStakeResult; 