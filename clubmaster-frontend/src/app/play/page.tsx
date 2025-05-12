'use client';

import React, { useState, useRef } from 'react';
import MatchmakingManager, { MatchmakingManagerHandle } from '@/app/components/MatchmakingManager';
import WaitingScreen from '../components/WaitingScreen';
import { FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// Define the window interface to properly type the window extensions
declare global {
  interface Window {
    startMatchmakingDebug?: () => void;
    cancelMatchmakingDebug?: () => void;
  }
}

// Map time values to game modes for consistency
const getGameModeFromTime = (timeInMinutes: number): string => {
  if (timeInMinutes <= 3) return 'Bullet';
  if (timeInMinutes <= 5) return 'Blitz';
  return 'Rapid';
};

/**
 * Match Setup page component
 * Allows users to select game mode, time control, and starting side
 */
const PlayPage: React.FC = () => {
  const matchmakingRef = useRef<MatchmakingManagerHandle>(null);
  const [activeTab, setActiveTab] = useState<string>('Rapid');
  const [selectedTime, setSelectedTime] = useState<number>(10);
  const [playAs, setPlayAs] = useState<string>('white');
  const [isMatchmaking, setIsMatchmaking] = useState<boolean>(false);
  const router = useRouter();
  
  // Function to get time value based on game mode
  const getTimeFromGameMode = (mode: string): number => {
    switch (mode.toLowerCase()) {
      case 'bullet':
        return 3;
      case 'blitz':
        return 5;
      case 'rapid':
        return 10;
      default:
        return 5;
    }
  };

  // Set the appropriate time when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedTime(getTimeFromGameMode(tab));
    console.log(`🔄 Tab changed to ${tab}, time set to: ${getTimeFromGameMode(tab)}`);
  };

  // Handle time selection
  const handleTimeSelection = (time: number) => {
    setSelectedTime(time);
    setActiveTab(getGameModeFromTime(time));
    console.log(`🔄 Time changed to ${time}, game mode set to: ${getGameModeFromTime(time)}`);
  };
  
  const handleMatchmakingError = (error: string) => {
    console.error('Matchmaking error:', error);
    setIsMatchmaking(false);
  };

  const handleGameFound = (gameId: string) => {
    console.log('Game found:', gameId);
    router.push(`/play/game/${gameId}`);
  };
  
  const handleStartMatchmaking = () => {
    console.log('Play Random clicked with:', { activeTab, selectedTime, playAs });
    
    // Get the correct time based on game mode
    const timeForMode = getTimeFromGameMode(activeTab);
    console.log('Time for selected game mode:', timeForMode);
    
    // Format time control string properly
    const timeControlStr = `${timeForMode}+0`;
    localStorage.setItem('timeControl', timeControlStr);
    console.log('📝 Stored time control in localStorage:', timeControlStr);
    
    // Also store the game mode (Bullet, Blitz, Rapid)
    localStorage.setItem('gameMode', activeTab);
    console.log('📝 Stored game mode in localStorage:', activeTab);
    
    setIsMatchmaking(true);
    
    // Pass the correct time control to MatchmakingManager
    if (matchmakingRef.current) {
      matchmakingRef.current.startMatchmaking(activeTab, String(timeForMode), playAs);
    } else {
      console.error('❌ MatchmakingManager ref not available');
    }
  };

  const handleCancelMatchmaking = () => {
    setIsMatchmaking(false);
    // Method 1: Try to find and click the cancel button directly
    const cancelButton = document.getElementById('cancel-matchmaking-button');
    if (cancelButton) {
      console.log('Found cancel button, clicking it');
      cancelButton.click();
      return;
    }
    
    // Method 2: Call the debug method directly
    if (typeof window !== 'undefined' && window.cancelMatchmakingDebug) {
      console.log('Using debug method');
      window.cancelMatchmakingDebug();
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      {isMatchmaking ? (
        <WaitingScreen 
          gameType={activeTab.toLowerCase()}
          timeInMinutes={selectedTime}
          onCancel={handleCancelMatchmaking}
        />
      ) : (
        <div className="w-full max-w-[430px] flex flex-col h-screen sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] sm:rounded-xl sm:shadow-lg sm:my-8" style={{ backgroundColor: '#333939' }}>
          {/* Header with back button - 21px padding */}
          <div className="px-[21px] pt-[21px] flex items-center">
            <Link href="/" className="text-[#BFC0C0] hover:text-gray-300 transition-colors">
              <FaArrowLeft size={20} />
            </Link>
            <h1 className="text-[22px] font-semibold mx-auto text-[#FAF3DD] font-poppins tracking-[0.25%]">Match Setup</h1>
          </div>
          
          <div className="flex flex-col flex-1 px-[21px] pt-[21px] pb-[21px]">
            {/* Game mode selection and time buttons in a grid layout */}
            <div className="grid grid-cols-3 gap-x-4 mb-[21px]">
              {/* Column 1: Bullet */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Bullet' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Bullet')}
                >
                  <Image 
                    src="/icons/time-modes/bullet.svg" 
                    alt="Bullet" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Bullet</span>
                </div>
                <TimeButton 
                  time={3}
                  isActive={selectedTime === 3}
                  onClick={() => handleTimeSelection(3)}
                />
              </div>
              
              {/* Column 2: Blitz */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Blitz' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Blitz')}
                >
                  <Image 
                    src="/icons/time-modes/blitz.svg" 
                    alt="Blitz" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Blitz</span>
                </div>
                <TimeButton 
                  time={5}
                  isActive={selectedTime === 5}
                  onClick={() => handleTimeSelection(5)}
                />
              </div>
              
              {/* Column 3: Rapid */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Rapid' ? 'text-[#FAF3DD]' : 'text-gray-400'} hover:text-[#FAF3DD] transition-colors`}
                  onClick={() => handleTabChange('Rapid')}
                >
                  <Image 
                    src="/icons/time-modes/rapid.svg" 
                    alt="Rapid" 
                    width={16} 
                    height={16} 
                    className="w-[16px] h-[16px]"
                  />
                  <span className="font-semibold text-[16px] font-poppins tracking-[0.25%]">Rapid</span>
                </div>
                <TimeButton 
                  time={10}
                  isActive={selectedTime === 10}
                  onClick={() => handleTimeSelection(10)}
                />
              </div>
            </div>
            
            {/* Play as selection - 21px bottom margin */}
            <div className="mb-[21px]">
              <div className="rounded-[10px] py-[10px] px-[14px] bg-[#4C5454] flex items-center">
                <p className="text-[#D9D9D9] text-[16px] font-roboto font-normal mr-auto">I play as</p>
                <div className="flex items-center gap-[12px]">
                  <PlayAsButton 
                    type="white"
                    isActive={playAs === 'white'}
                    onClick={() => setPlayAs('white')}
                  />
                  <PlayAsButton 
                    type="random"
                    isActive={playAs === 'random'}
                    onClick={() => setPlayAs('random')}
                  />
                  <PlayAsButton 
                    type="black"
                    isActive={playAs === 'black'}
                    onClick={() => setPlayAs('black')}
                  />
                </div>
              </div>
            </div>
            
            {/* Action buttons - 16px gap between buttons */}
            <div className="mt-auto flex flex-col gap-[16px]">
              <button
                onClick={handleStartMatchmaking}
                className="h-[57px] bg-[#4A7C59] hover:bg-[#3d6549] rounded-[10px] font-semibold transition-colors w-full border-2 border-[#E9CB6B] text-[#FAF3DD] text-[18px] font-poppins"
              >
                Play Random
              </button>
              
              <button
                onClick={() => console.log('Create link')}
                className="h-[57px] bg-[#4C5454] hover:bg-[#3d4343] rounded-[10px] font-semibold transition-colors w-full text-[#FAF3DD] text-[18px] font-poppins"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden MatchmakingManager component */}
      <MatchmakingManager
        ref={matchmakingRef}
        onError={handleMatchmakingError}
        onGameFound={handleGameFound}
      />
    </div>
  );
};

interface TimeButtonProps {
  time: number;
  isActive: boolean;
  onClick: () => void;
}

const TimeButton: React.FC<TimeButtonProps> = ({
  time,
  isActive,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-[117px] h-[47px] rounded-[10px] transition-colors ${
        isActive ? 'bg-[#4A7C59] hover:bg-[#3d6549]' : 'bg-[#4C5454] hover:bg-[#3d4343]'
      } text-[#FAF3DD] text-[16px] font-semibold font-poppins`}
    >
      {time} min
    </button>
  );
};

interface PlayAsButtonProps {
  type: 'white' | 'black' | 'random';
  isActive: boolean;
  onClick: () => void;
}

const PlayAsButton: React.FC<PlayAsButtonProps> = ({
  type,
  isActive,
  onClick,
}) => {
  // Get the appropriate icon path based on the type
  const getIconPath = () => {
    switch (type) {
      case 'white':
        return '/logos/white_side.svg';
      case 'black':
        return '/logos/black_side.svg';
      case 'random':
        return '/logos/random_side.svg';
      default:
        return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-[36px] h-[36px] flex items-center justify-center ${isActive ? 'bg-[#4A7C59] rounded-[10px]' : ''} transition-colors`}
    >
      <Image 
        src={getIconPath()} 
        alt={`${type} piece`}
        width={22}
        height={22}
        className="w-[22px] h-[22px]"
        priority
      />
    </button>
  );
};

export default PlayPage; 