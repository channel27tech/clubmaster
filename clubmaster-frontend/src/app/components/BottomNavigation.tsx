'use client';
import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useClub } from '../context/ClubContext';

interface BottomNavigationProps {
  onClubClick?: () => void;
}

export default function BottomNavigation({ onClubClick }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userType } = useClub();
  
  // Check if admin mode is active
  const isAdmin = userType === 'admin' || searchParams.get('admin') === '1';
  
  // Looking at the screenshots, the "home screen" with the club master header
  // and the buttons like "Start Game", "Tournaments", "Play for bet", etc.
  // is actually at "/club" path, and the home icon should be highlighted there
  
  // Determine active section based on the current path
  const isHome = pathname === '/' || pathname === '/club';
  
  // Updated to include all club-related screens
  const isClub = pathname === '/clubs' || 
                pathname === '/club/clubs' || 
                pathname.includes('/club/players') || 
                pathname.includes('/club/detail') || 
                pathname.includes('/club/preview') ||
                pathname.includes('/club/created-detail');
                
  const isTournament = pathname.includes('/tournament');
  const isBet = pathname.includes('/bet');
  
  // CSS filter perfectly matched to #E9CB6B text color
  const activeIconFilter = 'brightness(0) saturate(100%) invert(80%) sepia(38%) saturate(602%) hue-rotate(358deg) brightness(100%) contrast(94%)';
  
  // Handle club icon click based on user type
  const handleClubClick = () => {
    if (onClubClick) {
      onClubClick();
    } else {
      if (userType === 'hasClub') {
        router.push('/club/my-clubs');
      } else if (userType === 'admin') {
        router.push('/club/preview?admin=1');
      } else {
        router.push('/club/clubs');
      }
    }
  };
  
  const isMore = pathname === '/more';
  
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] bg-[#2B3131] flex justify-between items-center px-[21px] py-2 squared-t-xl border-t border-[#393E3E]" style={{zIndex: 50}}>
      <button 
        onClick={() => router.push('/club')}
        className="flex flex-col items-center flex-1"
      >
        <div className="flex items-center justify-center h-5">
          <Image
            src="/images/ftr home.svg"
            alt="Home"
            width={26}
            height={20}
            style={{ filter: isHome ? activeIconFilter : 'none' }}
          />
        </div>
        <span className={`${isHome ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Home</span>
      </button>
      <button 
        onClick={handleClubClick}
        className="flex flex-col items-center flex-1"
      >
        <div className="flex items-center justify-center h-5">
          <Image
            src="/images/ftr club.svg"
            alt="Club"
            width={22}
            height={22}
            style={{ filter: isClub ? activeIconFilter : 'none' }}
          />
        </div>
        <span className={`${isClub ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Club</span>
      </button>
      <div className="flex flex-col items-center flex-1">
        <div className="flex items-center justify-center h-5">
          <Image
            src="/images/ftr tournaments.svg"
            alt="Tournaments"
            width={22}
            height={22}
            style={{ filter: isTournament ? activeIconFilter : 'none' }}
          />
        </div>
        <span className={`${isTournament ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Tournaments</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <div className="flex items-center justify-center h-5">
          <Image
            src="/images/ftr bet.svg"
            alt="Bet"
            width={28}
            height={18}
            style={{ filter: isBet ? activeIconFilter : 'none' }}
          />
        </div>
        <span className={`${isBet ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Bet</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <button 
          onClick={() => router.push('/more')}
          className="flex flex-col items-center w-full"
        >
          <div className="flex items-center justify-center h-5">
            <Image
              src="/images/ftr more.svg"
              alt="More"
              width={26}
              height={19}
              style={{ filter: isMore ? activeIconFilter : 'none' }}
            />
          </div>
          <span className={`${isMore ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>More</span>
        </button>
      </div>
    </div>
  );
} 