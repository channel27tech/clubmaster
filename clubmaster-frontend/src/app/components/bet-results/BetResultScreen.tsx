'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { BetType } from '@/types/bet';
import Image from 'next/image';

interface BetResultScreenProps {
  result: 'win' | 'loss' | 'draw';
  betType: BetType;
  playerName: string;
  opponentName: string;
  playerRating: number;
  ratingChange: number;
  playerAvatar: string | null;
  opponentAvatar: string | null;
  opponentId: string;
  onRematch?: () => void;
  children?: React.ReactNode; // For bet-specific content
}

const BetResultScreen: React.FC<BetResultScreenProps> = ({
  result,
  playerName,
  opponentName,
  playerRating,
  ratingChange,
  playerAvatar,
  opponentAvatar,
  onRematch,
  children
}) => {
  const router = useRouter();
  
  const handleBackToHome = () => {
    router.push('/');
  };
  
  const handleShare = () => {
    // Share functionality
    console.log('Share result');
  };

  const isWinner = result === 'win';
  const scoreDisplay = isWinner ? '1 - 0' : '0 - 1';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-md mx-auto rounded-xl bg-[#23272F]/95 shadow-xl flex flex-col items-center p-0">
        {/* Header */}
        <div className={`w-full rounded-t-xl px-6 py-5 text-center ${isWinner ? 'bg-green-600' : 'bg-red-600'}`}>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {isWinner ? 'Congratulations!' : 'Better Luck Next Time!'}
          </h1>
          <h2 className="text-base md:text-lg text-yellow-300 font-semibold mt-1">
            {isWinner ? 'YOU WON THE BET!' : 'YOU LOSE THE BET!'}
          </h2>
        </div>

        {/* Player & Score Row */}
        <div className="flex items-center justify-around w-full px-6 mt-6 mb-2">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white bg-gray-300">
              {playerAvatar ? (
                <Image src={playerAvatar} alt={playerName} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-300" />
              )}
            </div>
            <div className="mt-2 text-xs md:text-sm text-white font-medium">You</div>
          </div>
          <div className="flex flex-col items-center mx-4">
            <div className="text-3xl md:text-4xl font-bold text-white">{scoreDisplay}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white bg-gray-300">
              {opponentAvatar ? (
                <Image src={opponentAvatar} alt={opponentName} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-300" />
              )}
            </div>
            <div className="mt-2 text-xs md:text-sm text-white font-medium">{opponentName}</div>
          </div>
        </div>

        {/* Rating Row */}
        <div className="flex items-center justify-center text-white my-2 text-base md:text-lg">
          <span className="mr-2">RATING :</span>
          <span className="text-2xl font-bold mr-2">{playerRating}</span>
          {ratingChange !== 0 && (
            <span className={`font-semibold ${ratingChange > 0 ? 'text-green-400' : 'text-red-400'}`}>{ratingChange > 0 ? `+${ratingChange}` : ratingChange}</span>
          )}
        </div>

        {/* Bet Outcome Section (children) */}
        <div className="w-full px-6">
          <div className="bg-[#2C313A] rounded-lg p-4 w-full text-center my-4">
            {children}
          </div>
        </div>

        {/* Main Action: Rematch */}
        <div className="w-full px-6 mb-2">
          <button
            onClick={onRematch}
            className="w-full bg-green-600 py-4 rounded-lg text-white font-semibold text-lg shadow-md hover:bg-green-700 transition-colors"
          >
            Rematch
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex w-full gap-4 px-6 pb-6">
          <button
            onClick={handleShare}
            className="flex-1 border border-gray-600 py-3 rounded-lg text-white font-medium hover:bg-gray-700 transition-colors"
          >
            Share
          </button>
          <button
            onClick={handleBackToHome}
            className="flex-1 border border-gray-600 py-3 rounded-lg text-white font-medium hover:bg-gray-700 transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default BetResultScreen; 