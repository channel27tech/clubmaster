'use client';
import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PlayerInfo from './PlayerInfo';
import MoveControls from './MoveControls';
import GameClock from './GameClock';
import { player1, player2 } from '../utils/mockData';
import { MoveHistoryState } from '../utils/moveHistory';
import DrawOfferNotification from './DrawOfferNotification';
import { useSocket } from '../../contexts/SocketContext';
import { useSound } from '../../contexts/SoundContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';

// Use dynamic import in a client component
const ChessBoard = dynamic(() => import('./ChessBoard'), {
  ssr: false,
});

export default function ChessBoardWrapper() {
  // Mock game ID - in a real app this would come from the game state
  const gameId = 'mock-game-id-123';
  
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState | null>(null);
  const { socket } = useSocket();
  const { soundEnabled } = useSound();
  
  // Game state
  const [gameState, setGameState] = useState({
    hasStarted: true,
    isWhiteTurn: true,
    hasWhiteMoved: false,
  });
  
  // Draw offer state
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferTimeRemaining, setDrawOfferTimeRemaining] = useState(30);
  const [drawOfferTimeout, setDrawOfferTimeout] = useState<NodeJS.Timeout | null>(null);

  // Preload sound effects when component mounts
  useEffect(() => {
    preloadSoundEffects(soundEnabled);
  }, [soundEnabled]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for draw offers
    socket.on('offer_draw', ({ player }) => {
      setDrawOfferReceived(true);
      
      // Play notification sound
      playSound('NOTIFICATION', soundEnabled);
      
      // Set a timeout to auto-decline after 30 seconds
      const timeout = setTimeout(() => {
        setDrawOfferReceived(false);
        socket.emit('decline_draw', { gameId });
      }, 30000);
      
      setDrawOfferTimeout(timeout);
      
      // Start countdown
      const countdownInterval = setInterval(() => {
        setDrawOfferTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // Game events that would update the game state
    socket.on('game_started', () => {
      setGameState(prev => ({ ...prev, hasStarted: true }));
      // Play game start sound
      playSound('GAME_START', soundEnabled);
    });
    
    socket.on('move_made', ({ player, isCapture, isCheck }) => {
      // Play appropriate sound for the move
      if (isCheck) {
        playSound('CHECK', soundEnabled);
      } else if (isCapture) {
        playSound('CAPTURE', soundEnabled);
      } else {
        playSound('MOVE', soundEnabled);
      }
      
      if (player === 'white') {
        setGameState(prev => ({ 
          ...prev, 
          isWhiteTurn: false,
          hasWhiteMoved: true 
        }));
      } else {
        setGameState(prev => ({ ...prev, isWhiteTurn: true }));
      }
    });
    
    socket.on('checkmate', () => {
      playSound('CHECKMATE', soundEnabled);
    });
    
    socket.on('draw', () => {
      playSound('DRAW', soundEnabled);
    });
    
    socket.on('game_end', () => {
      playSound('GAME_END', soundEnabled);
    });

    return () => {
      socket.off('offer_draw');
      socket.off('game_started');
      socket.off('move_made');
      socket.off('checkmate');
      socket.off('draw');
      socket.off('game_end');
      
      // Clear any existing timeouts
      if (drawOfferTimeout) {
        clearTimeout(drawOfferTimeout);
      }
    };
  }, [socket, gameId, drawOfferTimeout, soundEnabled]);
  
  // Handle move history updates from the ChessBoard component
  const handleMoveHistoryChange = useCallback((history: MoveHistoryState) => {
    setMoveHistory(history);
  }, []);
  
  // Handle back button click
  const handleBackClick = useCallback(() => {
    // These buttons interact with the board through its exposed methods
    // We're simulating a click on the hidden button in ChessBoard
    const backButton = document.querySelector('.hidden button:first-child') as HTMLButtonElement;
    if (backButton) {
      backButton.click();
    }
    
    // Play button click sound with button label
    playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Back');
  }, [soundEnabled]);
  
  // Handle forward button click
  const handleForwardClick = useCallback(() => {
    // These buttons interact with the board through its exposed methods
    // We're simulating a click on the hidden button in ChessBoard
    const forwardButton = document.querySelector('.hidden button:last-child') as HTMLButtonElement;
    if (forwardButton) {
      forwardButton.click();
    }
    
    // Play button click sound with button label
    playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Forward');
  }, [soundEnabled]);
  
  // Determine if we can go back/forward in the move history
  const canGoBack = moveHistory ? moveHistory.currentMoveIndex >= 0 : false;
  const canGoForward = moveHistory ? moveHistory.currentMoveIndex < moveHistory.moves.length - 1 : false;
  
  // Active player state - hardcoded to always make the bottom timer active (white player)
  // Using 'as const' to create a literal type that can be used in comparisons
  const activePlayer = 'white' as const;

  // Mock handler for time out events - disabled since we don't want timers to count down
  const handleTimeOut = (player: 'white' | 'black') => {
    console.log(`${player} player ran out of time - functionality disabled`);
    // Removed: setActivePlayer(null); // Stop both clocks
    
    // Play time out sound
    playSound('GAME_END', soundEnabled);
  };

  // Handle draw offer responses
  const handleAcceptDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('accept_draw', { gameId });
    setDrawOfferReceived(false);
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabled);
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameId, drawOfferTimeout, soundEnabled]);

  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('decline_draw', { gameId });
    setDrawOfferReceived(false);
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabled);
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameId, drawOfferTimeout, soundEnabled]);

  return (
    <div className="flex flex-col w-full">
      {/* Draw Offer Notification */}
      <DrawOfferNotification
        isOpen={drawOfferReceived}
        onAccept={handleAcceptDraw}
        onDecline={handleDeclineDraw}
        opponentName={player2.username}
        timeRemaining={drawOfferTimeRemaining}
      />
      
      {/* Player 1 Info (Top) with Timer */}
      <div className="flex justify-between items-center mb-2">
        <PlayerInfo 
          position="top"
          username={player1.username}
          rating={player1.rating}
          clubAffiliation={player1.clubAffiliation}
          isGuest={player1.isGuest}
          capturedPieces={player1.capturedPieces}
        />
        {/* Top player timer (Black) */}
        <div className="mr-2">
          <GameClock 
            timeInSeconds={554} // Example: 9:14 as shown in the image
            isActive={false} // Always inactive for top player
            isDarkTheme={false}
            onTimeOut={() => handleTimeOut('black')}
            playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
          />
        </div>
      </div>
      
      {/* Chess Board */}
      <ChessBoard 
        perspective="white"
        onMoveHistoryChange={handleMoveHistoryChange}
      />
      
    
      {/* Player 2 Info (Bottom) with Timer */}
      <div className="flex justify-between items-center mt-2">
        <PlayerInfo 
          position="bottom"
          username={player2.username}
          rating={player2.rating}
          clubAffiliation={player2.clubAffiliation}
          isGuest={player2.isGuest}
          capturedPieces={player2.capturedPieces}
        />
        {/* Bottom player timer (White) */}
        <div className="mr-2">
          <GameClock 
            timeInSeconds={476} // Example: 7:56 as shown in the image
            isActive={true} // Always active for bottom player
            isDarkTheme={false}
            onTimeOut={() => handleTimeOut('white')}
            playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
          />
        </div>
      </div>
      
      {/* Move Controls */}
      <MoveControls 
        onBack={handleBackClick}
        onForward={handleForwardClick}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        gameId={gameId}
        gameState={gameState}
      />
    </div>
  );
} 