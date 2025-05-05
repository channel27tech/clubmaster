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

// Use dynamic import in a client component
const ChessBoard = dynamic(() => import('./ChessBoard'), {
  ssr: false,
});

export default function ChessBoardWrapper() {
  // Mock game ID - in a real app this would come from the game state
  const gameId = 'mock-game-id-123';
  
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState | null>(null);
  const { socket } = useSocket();
  
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

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for draw offers
    socket.on('offer_draw', ({ player }) => {
      setDrawOfferReceived(true);
      
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
    });
    
    socket.on('move_made', ({ player }) => {
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

    return () => {
      socket.off('offer_draw');
      socket.off('game_started');
      socket.off('move_made');
      
      // Clear any existing timeouts
      if (drawOfferTimeout) {
        clearTimeout(drawOfferTimeout);
      }
    };
  }, [socket, gameId, drawOfferTimeout]);
  
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
  }, []);
  
  // Handle forward button click
  const handleForwardClick = useCallback(() => {
    // These buttons interact with the board through its exposed methods
    // We're simulating a click on the hidden button in ChessBoard
    const forwardButton = document.querySelector('.hidden button:last-child') as HTMLButtonElement;
    if (forwardButton) {
      forwardButton.click();
    }
  }, []);
  
  // Determine if we can go back/forward in the move history
  const canGoBack = moveHistory ? moveHistory.currentMoveIndex >= 0 : false;
  const canGoForward = moveHistory ? moveHistory.currentMoveIndex < moveHistory.moves.length - 1 : false;
  
  // State to track active player (in a real game, this would be derived from game state)
  const [activePlayer, setActivePlayer] = useState<'white' | 'black' | null>('white');
  
  // Mock handler for time out events
  const handleTimeOut = (player: 'white' | 'black') => {
    console.log(`${player} player ran out of time`);
    setActivePlayer(null); // Stop both clocks
  };

  // Handle draw offer responses
  const handleAcceptDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('accept_draw', { gameId });
    setDrawOfferReceived(false);
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameId, drawOfferTimeout]);

  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('decline_draw', { gameId });
    setDrawOfferReceived(false);
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameId, drawOfferTimeout]);

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
            isActive={activePlayer === 'black'}
            isDarkTheme={false}
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
            timeInSeconds={500} // Example: 8:20 as shown in the image
            isActive={activePlayer === 'white'}
            isDarkTheme={true}
          />
        </div>
      </div>
      {/* Move Controls - Moved to the bottom */}
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