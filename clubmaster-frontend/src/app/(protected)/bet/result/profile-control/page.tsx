"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfileControlResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWinner = searchParams.get('isWinner') === 'true';
  const gameId = searchParams.get('gameId') || '';
  const [opponentName, setOpponentName] = useState<string>('');
  const [opponentId, setOpponentId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, we would fetch the opponent information from the server
    // For now, we'll use mock data or localStorage
    const fetchGameResult = async () => {
      try {
        // Try to get opponent info from localStorage (populated by the game)
        const gameResultStr = localStorage.getItem(`gameResult_${gameId}`);
        if (gameResultStr) {
          const gameResult = JSON.parse(gameResultStr);
          setOpponentName(gameResult.opponentName || 'Opponent');
          // In a real implementation, we would have the actual opponent ID
          setOpponentId(gameResult.opponentId || '1');
        } else {
          // Fallback to defaults
          setOpponentName('Opponent');
          setOpponentId('1');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching game result:', error);
        setOpponentName('Opponent');
        setOpponentId('1');
        setLoading(false);
      }
    };

    fetchGameResult();
  }, [gameId]);

  const handleEditProfile = () => {
    router.push(`/bet/edit_opponent_profile?id=${opponentId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#333939]">
        <div className="text-[#FAF3DD]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-[#333939]">
      {/* Header */}
      <div className="w-full sticky top-0 z-10" style={{ background: "#333939" }}>
        <div className="flex items-center px-4 py-4">
          <Link href="/" className="mr-2">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" stroke="#FAF3DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-[22px] font-semibold" style={{ color: "#FAF3DD", letterSpacing: 1, fontFamily: 'Roboto' }}>
            Bet Result
          </h1>
          <span className="w-8" />
        </div>
      </div>

      {/* Result Card */}
      <div className="w-full max-w-[346px] mx-auto my-8 p-6 bg-[#4C5454] rounded-[10px] flex flex-col items-center">
        {/* Title */}
        <h3 className="font-semibold text-[20px] tracking-[0.25%] text-[#FAF3DD] mb-4">
          {isWinner 
            ? "Whoo-ho! Profile Control Granted!" 
            : "Oops! Profile Control Lost!"}
        </h3>
        
        {/* Description */}
        <p className="font-normal text-[16px] tracking-[0.25%] text-[#D9D9D9] text-center mb-6">
          {isWinner 
            ? `You now have control over ${opponentName}'s profile for the next 24 hours` 
            : `Your opponent now has control over your profile for the next 24 hours`}
        </p>
        
        {/* Trophy/Loss Image */}
        <div className="mb-6">
          <Image 
            src={isWinner ? "/bet_images/trophy.svg" : "/bet_images/lost.svg"} 
            alt={isWinner ? "Trophy" : "Lost"} 
            width={120} 
            height={120}
            // Fallback if image doesn't exist
            onError={(e) => {
              e.currentTarget.src = isWinner ? "/bet_images/bet_profile_1.svg" : "/bet_images/bet_profile_2.svg"
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-4">
          {isWinner && (
            <button
              onClick={handleEditProfile}
              className="w-full h-[50px] bg-[#4A7C59] border-2 border-[#E9CB6B] rounded-[10px] text-[#FAF3DD] font-medium text-[16px]"
            >
              Edit Their Profile
            </button>
          )}
          
          <Link href="/" className="w-full">
            <button
              className="w-full h-[50px] bg-transparent border-2 border-[#4A7C59] rounded-[10px] text-[#FAF3DD] font-medium text-[16px]"
            >
              Return to Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
} 