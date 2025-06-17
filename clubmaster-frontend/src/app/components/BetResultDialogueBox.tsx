import React from 'react';

export type BetResultType = 'win' | 'loss' | 'draw';
export type BetType = 'PROFILE_CONTROL' | 'PROFILE_LOCK' | 'RATING_STAKE' | string;

interface BetResultDialogueBoxProps {
  isWinner: boolean;
  opponentName: string;
  onEditProfileClick?: () => void;
  betType?: BetType;
  result?: BetResultType;
}

const BetResultDialogueBox: React.FC<BetResultDialogueBoxProps> = ({
  isWinner,
  opponentName,
  onEditProfileClick,
  betType = 'PROFILE_CONTROL',
  result = isWinner ? 'win' : 'loss',
}) => {
  // Dynamic content mapping
  let title = '';
  let description = '';
  let showEditProfile = false;

  switch (betType) {
    case 'PROFILE_CONTROL':
      if (result === 'draw') {
        title = 'Draw! No Profile Control Granted';
        description = 'No one gets profile control. Play again to win the bet!';
      } else if (isWinner) {
        title = 'Whoo-ho! Profile Control Granted!';
        description = `You now have control over ${opponentName}'s profile for the next 24 hours.`;
        showEditProfile = true;
      } else {
        title = 'Oops! Profile Control Lost!';
        description = 'Your opponent now has control over your profile for the next 24 hours.';
      }
      break;
    case 'PROFILE_LOCK':
      if (result === 'draw') {
        title = 'Draw! No Profile Lock';
        description = 'No one gets profile lock. Play again to win the bet!';
      } else if (isWinner) {
        title = 'Victory! Profile Lock Imposed!';
        description = `You have locked ${opponentName}'s profile for 24 hours.`;
      } else {
        title = 'Defeat! Profile Locked!';
        description = 'Your profile has been locked by your opponent for 24 hours.';
      }
      break;
    case 'RATING_STAKE':
      if (result === 'draw') {
        title = 'Draw! No Rating Change';
        description = 'No rating points exchanged. Play again to win the bet!';
      } else if (isWinner) {
        title = 'Congratulations! Rating Won!';
        description = `You have won rating points from ${opponentName}.`;
      } else {
        title = 'Rating Lost!';
        description = 'You have lost rating points to your opponent.';
      }
      break;
    default:
      // Fallback to profile control logic
      if (result === 'draw') {
        title = 'Draw! No Bet Outcome';
        description = 'No one wins the bet. Play again!';
      } else if (isWinner) {
        title = 'Bet Won!';
        description = `You have won the bet against ${opponentName}.`;
      } else {
        title = 'Bet Lost!';
        description = 'You have lost the bet.';
      }
      break;
  }

  return (
    <div className="flex flex-col items-center min-h-[142px] max-w-[346px] w-full rounded-[10px] bg-[#4C5454] p-[10px] mb-[21px] mx-auto">
      {/* Title */}
      <div className="font-poppins font-semibold text-[16px] tracking-[0.0025em] text-[#FAF3DD] mb-2 text-center">
        {title}
      </div>
      {/* Description */}
      <div className="font-roboto font-normal text-[14px] tracking-[0.0025em] text-[#D9D9D9] mb-4 text-center">
        {description}
      </div>
      {/* Edit Profile Button */}
      {showEditProfile && (
        <button
          className="h-[30px] w-[100px] rounded-[5px] bg-[#4A7C59] border-2 border-[#E9CB6B] text-[#FAF3DD] font-semibold font-roboto text-[14px] mx-auto"
          onClick={onEditProfileClick}
        >
          Edit Profile
        </button>
      )}
    </div>
  );
};

export default BetResultDialogueBox; 