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
  const [activeTab, setActiveTab] = useState<string>('Blitz');
  const [selectedTime, setSelectedTime] = useState<number>(5);
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
        <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex flex-col h-screen sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] sm:rounded-xl sm:shadow-lg sm:my-8" style={{ backgroundColor: '#333939' }}>
          {/* Header with back button */}
          <div className="p-4 pt-6 md:p-6 flex items-center">
            <Link href="/" className="text-white hover:text-gray-300 transition-colors">
              <FaArrowLeft size={20} />
            </Link>
            <h1 className="text-xl md:text-2xl font-semibold mx-auto text-white">Match Setup</h1>
          </div>
          
          <div className="flex flex-col flex-1 p-4 sm:p-6 pt-6 sm:pt-8">
            {/* Game type headers */}
            <div className="flex justify-between mb-6 sm:mb-8">
              <div 
                className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Bullet' ? 'text-white' : 'text-gray-400'} hover:text-white transition-colors`}
                onClick={() => handleTabChange('Bullet')}
              >
                <span>🚀</span>
                <span className="font-medium">Bullet</span>
              </div>
              <div 
                className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Blitz' ? 'text-white' : 'text-gray-400'} hover:text-white transition-colors`}
                onClick={() => handleTabChange('Blitz')}
              >
                <span>⚡</span>
                <span className="font-medium">Blitz</span>
              </div>
              <div 
                className={`flex items-center gap-1 cursor-pointer ${activeTab === 'Rapid' ? 'text-white' : 'text-gray-400'} hover:text-white transition-colors`}
                onClick={() => handleTabChange('Rapid')}
              >
                <span>⏱️</span>
                <span className="font-medium">Rapid</span>
              </div>
            </div>
            
            {/* Time selection buttons */}
            <div className="flex justify-between gap-2 sm:gap-4 mb-8 sm:mb-12">
              <TimeButton 
                time={3}
                isActive={selectedTime === 3}
                onClick={() => handleTimeSelection(3)}
              />
              <TimeButton 
                time={5}
                isActive={selectedTime === 5}
                onClick={() => handleTimeSelection(5)}
              />
              <TimeButton 
                time={10}
                isActive={selectedTime === 10}
                onClick={() => handleTimeSelection(10)}
              />
            </div>
            
            {/* Play as selection */}
            <div className="mb-8 sm:mb-12">
              <div className="rounded-lg p-3 sm:p-4 border border-[#4C5454] bg-[#4C5454]">
                <p className="text-center mb-2 sm:mb-3 text-gray-300 font-medium sm:text-lg">I play as</p>
                <div className="flex justify-center gap-3 sm:gap-6">
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
            
            {/* Action buttons */}
            <div className="mt-auto flex flex-col gap-3 sm:gap-4">
              <button
                onClick={handleStartMatchmaking}
                className="py-3 sm:py-4 bg-[#4A7C59] hover:bg-[#3d6549] rounded-lg font-medium transition-colors w-full border-2 border-[#E9CB6B] text-white text-base sm:text-lg"
              >
                Play Random
              </button>
              
              <button
                onClick={() => console.log('Create link')}
                className="py-3 sm:py-4 bg-[#4C5454] hover:bg-[#3d4343] rounded-lg font-medium transition-colors w-full border border-[#5a6363] text-white text-base sm:text-lg"
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
      className={`flex-1 py-2 sm:py-3 rounded-lg transition-colors ${
        isActive ? 'bg-[#4A7C59] hover:bg-[#3d6549] border border-[#5d8f6c]' : 'bg-[#4C5454] hover:bg-[#3d4343] border border-[#5a6363]'
      } text-white text-sm sm:text-base`}
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
      className={`p-2 sm:p-3 ${isActive ? 'bg-[#4A7C59] rounded-lg' : ''} transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center`}
    >
      <Image 
        src={getIconPath()} 
        alt={`${type} piece`}
        width={24}
        height={24}
        className="w-5 h-5 sm:w-6 sm:h-6"
        priority
      />
    </button>
  );
};

export default PlayPage; 