'use client';
import React from 'react';
import BetResultScreen from './BetResultScreen';
import { BetType } from '@/types/bet';

interface ProfileLockResultProps {
  result: 'win' | 'loss' | 'draw';
  playerName: string;
  opponentName: string;
  playerRating: number;
  ratingChange: number;
  playerAvatar: string | null;
  opponentAvatar: string | null;
  opponentId: string;
  lockDurationHours?: number;
  onRematch?: () => void;
}

const ProfileLockResult: React.FC<ProfileLockResultProps> = ({
  result,
  playerName,
  opponentName,
  playerRating,
  ratingChange,
  playerAvatar,
  opponentAvatar,
  opponentId,
  lockDurationHours = 24,
  onRematch
}) => {
  const isWinner = result === 'win';
  
  return (
    <BetResultScreen
      result={result}
      betType={BetType.PROFILE_LOCK}
      playerName={playerName}
      opponentName={opponentName}
      playerRating={playerRating}
      ratingChange={ratingChange}
      playerAvatar={playerAvatar}
      opponentAvatar={opponentAvatar}
      opponentId={opponentId}
      onRematch={onRematch}
    >
      {isWinner && (
        <div className="bg-gray-700 rounded-lg p-4 w-full text-center my-4">
          <h3 className="text-xl font-semibold text-white mb-2">
            Profile Lock Victory!
          </h3>
          <p className="text-gray-200">
            {opponentName}'s profile is now locked for the next {lockDurationHours} hours
          </p>
        </div>
      )}
      
      {!isWinner && (
        <div className="bg-gray-700 rounded-lg p-4 w-full text-center my-4">
          <h3 className="text-xl font-semibold text-white mb-2">
            Profile Locked!
          </h3>
          <p className="text-gray-200">
            Your profile is locked for the next {lockDurationHours} hours
          </p>
          <p className="text-gray-300 text-sm mt-2">
            You cannot change your profile until the lock expires
          </p>
        </div>
      )}
    </BetResultScreen>
  );
};

export default ProfileLockResult; 