'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BetType } from '@/types/bet';

interface BetDialogueBoxProps {
  betType: BetType;
  isBetGameWinner: boolean;
  opponentName: string;
  opponentId?: string;
}

/**
 * Component that shows the bet result dialogue box for different bet types.
 * Currently supports PROFILE_CONTROL bet type.
 */
const BetDialogueBox: React.FC<BetDialogueBoxProps> = ({
  betType,
  isBetGameWinner,
  opponentName,
  opponentId,
}) => {
  const router = useRouter();

  // Check if we should show this dialogue box
  if (betType !== BetType.PROFILE_CONTROL) {
    return null;
  }

  // Navigate to edit opponent profile page
  const handleEditProfile = () => {
    if (opponentId) {
      router.push(`/bet/edit_opponent_profile?id=${opponentId}`);
    } else {
      console.error('No opponent ID provided for profile editing');
    }
  };

  return (
    <div className="w-full max-w-[346px] mx-auto my-4 p-4 bg-[#4C5454] rounded-[10px] flex flex-col items-center">
      {/* Title */}
      <h3 className="font-semibold text-[16px] tracking-[0.25%] text-[#FAF3DD] mb-2">
        {isBetGameWinner 
          ? "Whoo-ho! Profile Control Granted!" 
          : "Oops! Profile Control Lost!"}
      </h3>
      
      {/* Description */}
      <p className="font-normal text-[14px] tracking-[0.25%] text-[#D9D9D9] text-center mb-4">
        {isBetGameWinner 
          ? `You now have control over ${opponentName}'s profile for the next 24 hours` 
          : `Your opponent now has control over your profile for the next 24 hours`}
      </p>
      
      {/* Edit Profile button - only shown to winner */}
      {isBetGameWinner && (
        <button
          onClick={handleEditProfile}
          className="h-[30px] w-[100px] bg-[#4A7C59] border-2 border-[#E9CB6B] rounded-[5px] text-[#FAF3DD] font-medium"
        >
          Edit Profile
        </button>
      )}
    </div>
  );
};

export default BetDialogueBox; 