'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNavigation() {
  const pathname = usePathname();
  
  // Looking at the screenshots, the "home screen" with the club master header
  // and the buttons like "Start Game", "Tournaments", "Play for bet", etc.
  // is actually at "/club" path, and the home icon should be highlighted there
  
  // Determine active section based on the current path
  const isHome = pathname === '/' || pathname === '/club';
  const isClub = pathname === '/clubs' || pathname === '/club/clubs';
  
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] bg-[#2B3131] flex justify-between items-center px-2 py-2 squared-t-xl border-t border-[#393E3E]" style={{zIndex: 50}}>
      <Link href="/club" className="flex flex-col items-center flex-1">
        <span className={`${isHome ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xl`}>🏠</span>
        <span className={`${isHome ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Home</span>
      </Link>
      <Link href="/clubs" className="flex flex-col items-center flex-1">
        <span className={`${isClub ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xl`}>🏛️</span>
        <span className={`${isClub ? 'text-[#E9CB6B]' : 'text-[#BDBDBD]'} text-xs mt-1`}>Club</span>
      </Link>
      <div className="flex flex-col items-center flex-1">
        <span className="text-[#BDBDBD] text-xl">🏆</span>
        <span className="text-[#BDBDBD] text-xs mt-1">Tournaments</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <span className="text-[#BDBDBD] text-xl">💰</span>
        <span className="text-[#BDBDBD] text-xs mt-1">Bet</span>
      </div>
      <div className="flex flex-col items-center flex-1">
        <span className="text-[#BDBDBD] text-xl">☰</span>
        <span className="text-[#BDBDBD] text-xs mt-1">More</span>
      </div>
    </div>
  );
} 