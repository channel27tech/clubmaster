'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import BetResultScreen from './BetResultScreen';
import { BetType } from '@/types/bet';

interface ProfileControlResultProps {
  result: 'win' | 'loss' | 'draw';
  playerName: string;
  opponentName: string;
  playerRating: number;
  ratingChange: number;
  playerAvatar: string | null;
  opponentAvatar: string | null;
  opponentId: string;
  controlDurationHours?: number;
  onRematch?: () => void;
}

const ProfileControlResult: React.FC<ProfileControlResultProps> = ({
  result,
  playerName,
  opponentName,
  playerRating,
  ratingChange,
  playerAvatar,
  opponentAvatar,
  opponentId,
  controlDurationHours = 24,
  onRematch
}) => {
  const router = useRouter();
  
  const handleEditProfile = () => {
    router.push(`/bet/edit_opponent_profile/?opponentId=${opponentId}`);
  };

  // Only show profile control message and edit button if user won
  const isWinner = result === 'win';
  
  return (
    <BetResultScreen
      result={result}
      betType={BetType.PROFILE_CONTROL}
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
            Whoo-ho! Profile Control Granted!
          </h3>
          <p className="text-gray-200 mb-4">
            You now have control over {opponentName}'s profile for the next {controlDurationHours} hours
          </p>
          <button 
            onClick={handleEditProfile}
            className="px-6 py-2 bg-transparent border border-yellow-400 rounded text-yellow-400 font-medium hover:bg-yellow-400 hover:text-gray-800 transition-colors"
          >
            Edit Profile
          </button>
        </div>
      )}
      
      {!isWinner && (
        <div className="bg-gray-700 rounded-lg p-4 w-full text-center my-4">
          <h3 className="text-xl font-semibold text-white mb-2">
            Profile Control Lost!
          </h3>
          <p className="text-gray-200">
            {opponentName} now has control over your profile for the next {controlDurationHours} hours
          </p>
        </div>
      )}
    </BetResultScreen>
  );
};

export default ProfileControlResult; 