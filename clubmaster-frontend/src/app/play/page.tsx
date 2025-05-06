'use client';

import React, { useState, useRef } from 'react';
import MatchmakingManager from '../components/MatchmakingManager';
import { FaChessKnight, FaClock, FaArrowLeft, FaRandom } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Match Setup page component
 * Allows users to select game mode, time control, and starting side
 */
const PlayPage: React.FC = () => {
  const matchmakingRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('Blitz');
  const [selectedTime, setSelectedTime] = useState<number>(5);
  const [playAs, setPlayAs] = useState<string>('white');
  
  const handleStartMatchmaking = () => {
    console.log('Play Random clicked with:', { activeTab, selectedTime, playAs });
    
    // Method 1: Try to find and click the start button directly
    const startButton = document.getElementById('start-matchmaking-button');
    if (startButton) {
      console.log('Found start button, clicking it');
      startButton.click();
      return;
    }
    
    // Method 2: Call the debug method directly
    if (typeof window !== 'undefined' && (window as any).startMatchmakingDebug) {
      console.log('Using debug method');
      (window as any).startMatchmakingDebug();
      return;
    }
    
    // Method 3: If all else fails, try to directly show the waiting screen
    console.log('Fallback: Set matchmaking state manually');
    // This is a last resort if the component structure is causing issues
    if (matchmakingRef.current) {
      const managerComponent = matchmakingRef.current.querySelector('[data-matchmaking-active]');
      if (managerComponent) {
        managerComponent.setAttribute('data-matchmaking-active', 'true');
      }
    }
  };

  // Set the appropriate time when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Set default time for each game type
    switch (tab) {
      case 'Bullet':
        setSelectedTime(3);
        break;
      case 'Blitz':
        setSelectedTime(5);
        break;
      case 'Rapid':
        setSelectedTime(10);
        break;
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
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
              onClick={() => setSelectedTime(3)}
            />
            <TimeButton 
              time={5}
              isActive={selectedTime === 5}
              onClick={() => setSelectedTime(5)}
            />
            <TimeButton 
              time={10}
              isActive={selectedTime === 10}
              onClick={() => setSelectedTime(10)}
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
        
        {/* Hidden MatchmakingManager component */}
        <div ref={matchmakingRef}>
          <MatchmakingManager />
        </div>
      </div>
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