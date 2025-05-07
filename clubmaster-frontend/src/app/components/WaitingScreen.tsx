'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as socketService from '../../services/socketService';
import Header from './Header';

interface WaitingScreenProps {
  gameType?: string;
  onCancel: () => void;
  timeInMinutes?: number;
  username?: string;
  rating?: number;
}

const WaitingScreen: React.FC<WaitingScreenProps> = ({ 
  gameType = 'blitz',
  onCancel,
  timeInMinutes = 10,
  username = 'supi1981',
  rating = 1762
}) => {
  const [waitTime, setWaitTime] = useState<number>(0);
  const [searchingText, setSearchingText] = useState<string>('Searching...');
  const router = useRouter();
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Effect to handle socket events for matchmaking
  useEffect(() => {
    // Set up match found listener
    const handleMatchFound = (gameData: any) => {
      console.log('Match found:', gameData);
      // Navigate to the game page
      if (gameData && gameData.gameId) {
        router.push(`/game/${gameData.gameId}`);
      }
    };
    
    // Set up error handling
    const handleMatchmakingError = (error: any) => {
      console.error('Matchmaking error:', error);
      setConnectionError(error.message || 'Connection error occurred');
    };
    
    // Register listeners
    socketService.onMatchFound(handleMatchFound);
    socketService.onMatchmakingError(handleMatchmakingError);
    
    // Cleanup function
    return () => {
      // Remove listeners
      socketService.offMatchFound(handleMatchFound);
      socketService.offMatchmakingError(handleMatchmakingError);
    };
  }, [router]);
  
  // Increment wait time every second and update searching text animation
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
      
      // Update searching text with dots animation
      setSearchingText(current => {
        if (current === 'Searching...') return 'Searching';
        return current + '.';
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const handleCancel = () => {
    socketService.cancelMatchmaking();
    onCancel();
  };

  // Format wait time as mm:ss
  const formatWaitTime = () => {
    const minutes = Math.floor(waitTime / 60);
    const seconds = waitTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col backdrop-blur-sm bg-[#2B3131]/60 overflow-hidden">
      {/* Use the same header as the main chessboard */}
      <Header />
      
      <div className="flex-grow flex flex-col items-center overflow-hidden">
        {/* Central content area with max width matching the chessboard */}
        <div className="w-full max-w-md mx-auto flex flex-col h-full">
          {/* Top player info section */}
          <div className="w-full bg-[#4A7C59] py-3 px-4 flex justify-between items-center border-b border-black">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#E9CB6B] flex items-center justify-center rounded mr-2">
                <span className="text-[#2B3131] text-lg">♟</span>
              </div>
              <span className="text-white text-lg font-medium">{searchingText}</span>
            </div>
            <div className="text-white bg-[#5E8C69] px-4 py-1 rounded-md font-mono text-lg">{timeInMinutes}:00</div>
          </div>
          
          {/* Central area with the waiting dialog */}
          <div className="flex-grow flex items-center justify-center">
            <div className="bg-[#2B3131] p-6 rounded-lg text-center shadow-xl w-72">
              <div className="text-white font-bold text-lg mb-3">{timeInMinutes} min {gameType}</div>
              <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center border-2 border-[#4A7C59]">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-[#4A7C59]" fill="currentColor">
                  <path d="M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"></path>
                  <path d="M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"></path>
                </svg>
              </div>
              <div className="text-gray-400 text-lg">Waiting for opponent..</div>
              {connectionError && (
                <div className="text-red-400 text-sm mt-2">{connectionError}</div>
              )}
              <div className="text-gray-400 text-sm mt-3">Wait time: {formatWaitTime()}</div>
            </div>
          </div>
          
          {/* Bottom player info section */}
          <div className="w-full bg-[#4A7C59] py-3 px-4 flex justify-between items-center border-t border-black">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#2B3131] flex items-center justify-center rounded mr-2">
                <span className="text-white text-lg">♟</span>
              </div>
              <span className="text-white text-lg font-medium">{username} ({rating})</span>
            </div>
            <div className="text-white bg-[#5E8C69] px-4 py-1 rounded-md font-mono text-lg">{timeInMinutes}:00</div>
          </div>
          
          {/* Cancel button */}
          <div className="w-full bg-[#2B3131] p-4">
            <button 
              onClick={handleCancel}
              className="w-full py-3 bg-[#3D3D3D] hover:bg-[#4A4A4A] text-white font-medium rounded-md transition-colors text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingScreen; 