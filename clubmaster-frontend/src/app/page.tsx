'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChessBoardWrapper from './components/ChessBoardWrapper';
import Header from './components/Header';
import MoveTracker from './components/MoveTracker';
import WaitingScreen from './components/WaitingScreen';
import GameResultScreen from './components/GameResultScreen';
import { useSocket } from '../contexts/SocketContext';
import { GameResult } from './utils/types';

export default function Home() {
  const router = useRouter();
  const { socket, gameEnded, gameEndData, resetGameEnd } = useSocket();
  const [showWaitingScreen, setShowWaitingScreen] = useState(true);
  const [gameType, setGameType] = useState('standard');
  const [gameTime, setGameTime] = useState(10); // Default 10 minute game

  // Game result screen state
  const [showGameResult, setShowGameResult] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult>({
    result: 'win',
    reason: 'checkmate',
    playerName: 'Asif',
    opponentName: 'Basith',
    playerRating: 1762,
    opponentRating: 2780,
    playerRatingChange: 12,
    opponentRatingChange: -12
  });

  // Control body overflow when waiting screen or game result is shown
  useEffect(() => {
    if (showWaitingScreen || showGameResult) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    // Reset overflow when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showWaitingScreen, showGameResult]);

  // When a game ends, handle the result display
  useEffect(() => {
    if (gameEnded && gameEndData) {
      // Process the game end data to format it for our result screen
      const result = gameEndData.winner === 'you' ? 'win' : 
                     gameEndData.winner === 'opponent' ? 'loss' : 'draw';
      
      setGameResult({
        result,
        reason: gameEndData.reason || 'checkmate',
        playerName: gameEndData.playerName || 'You',
        opponentName: gameEndData.opponentName || 'Opponent',
        playerRating: gameEndData.playerRating || 1500,
        opponentRating: gameEndData.opponentRating || 1500,
        playerRatingChange: gameEndData.playerRatingChange || (result === 'win' ? 10 : (result === 'loss' ? -10 : 0)),
        opponentRatingChange: gameEndData.opponentRatingChange || (result === 'loss' ? 10 : (result === 'win' ? -10 : 0))
      });
      
      // Show the result screen after 5 seconds
      // This allows the player to see the final board state before showing the result
      setTimeout(() => {
        setShowGameResult(true);
      }, 100000);
    }
  }, [gameEnded, gameEndData]);

  // For testing purposes: show game end screen 5 seconds after chess board appears
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // If waiting screen is hidden (chess board is visible) and game result is not showing yet
    if (!showWaitingScreen && !showGameResult) {
      // Set a timer to show the game end screen after 5 seconds
      timer = setTimeout(() => {
        // Sample win result
        setGameResult({
          result: 'win',
          reason: 'checkmate',
          playerName: 'Asif',
          opponentName: 'Basith',
          playerRating: 1762,
          opponentRating: 2780,
          playerRatingChange: 12,
          opponentRatingChange: -12
        });
        setShowGameResult(true);
      }, 100000);
    }
    
    // Clean up timer when component unmounts or dependencies change
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showWaitingScreen, showGameResult]);

  const handleMatchmakingComplete = () => {
    // Hide the waiting screen when matchmaking completes
    setShowWaitingScreen(false);
  };

  const handleGameResultClose = () => {
    setShowGameResult(false);
    // Reset the game end state in the socket context
    resetGameEnd();
    // Return to the main menu or reset the game
    setShowWaitingScreen(true);
  };

  return (
    <main className="flex flex-col min-h-screen bg-[#4A7C59]">
      {/* Main content always renders - will be visible through blurred overlays */}
      <div className="relative w-full min-h-screen">
        <Header />
        <div className="mb-4">
          <MoveTracker />
        </div>
        <div className="flex-grow flex flex-col items-center justify-center">
          <div className="w-full max-w-md mx-auto px-4">
            <ChessBoardWrapper />
          </div>
        </div>
      </div>

      {/* Overlays */}
      {/* Waiting screen overlay - appears during matchmaking */}
      {showWaitingScreen && (
        <WaitingScreen 
          gameType={gameType}
          timeInMinutes={gameTime}
          onCancel={handleMatchmakingComplete}
        />
      )}

      {/* Game result screen overlay - appears after the game ends */}
      {showGameResult && (
        <GameResultScreen
          result={gameResult.result}
          reason={gameResult.reason}
          playerName={gameResult.playerName}
          opponentName={gameResult.opponentName}
          playerRating={gameResult.playerRating}
          opponentRating={gameResult.opponentRating}
          playerRatingChange={gameResult.playerRatingChange}
          opponentRatingChange={gameResult.opponentRatingChange}
          onClose={handleGameResultClose}
        />
      )}
    </main>
  );
}
