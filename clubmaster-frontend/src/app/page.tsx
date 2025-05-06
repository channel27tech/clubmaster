'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChessBoardWrapper from './components/ChessBoardWrapper';
import Header from './components/Header';
import MoveTracker from './components/MoveTracker';
import WaitingScreen from './components/WaitingScreen';

export default function Home() {
  const router = useRouter();
  const [showWaitingScreen, setShowWaitingScreen] = useState(true);
  const [gameType, setGameType] = useState('standard');
  const [gameTime, setGameTime] = useState(10); // Default 10 minute game

  // Control body overflow when waiting screen is shown
  useEffect(() => {
    // Prevent scrolling when waiting screen is active
    if (showWaitingScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    // Reset overflow when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showWaitingScreen]);

  // When the component mounts, start in matchmaking mode by default
  useEffect(() => {
    // This gives the impression that we're starting with matchmaking
    // In a real app, this could be controlled by routing or user preferences
  }, []);

  const handleMatchmakingComplete = () => {
    // This is called when matchmaking is cancelled or a match is found
    setShowWaitingScreen(false);
  };

  return (
    <div className={`flex flex-col min-h-screen bg-[#4A7C59] ${showWaitingScreen ? 'overflow-hidden h-screen' : ''}`}>
      {/* Always render the chessboard - it will be visible when not in matchmaking mode
          or it will be blurred in the background during matchmaking */}
      <div className="relative w-full">
        <Header />
        <MoveTracker />
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="w-full max-w-md mx-auto">
            <ChessBoardWrapper />
          </div>
        </div>
      </div>

      {/* Show waiting screen overlay */}
      {showWaitingScreen && (
        <WaitingScreen 
          gameType={gameType}
          timeInMinutes={gameTime}
          onCancel={handleMatchmakingComplete}
        />
      )}
    </div>
  );
}
