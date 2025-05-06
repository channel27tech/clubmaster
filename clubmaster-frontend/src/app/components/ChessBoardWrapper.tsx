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
import { getGameStatus, getChessEngine } from '../utils/chessEngine';
import { useSound } from '../../contexts/SoundContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';
import { CapturedPiece } from '../utils/types';

// Use dynamic import in a client component
const ChessBoard = dynamic(() => import('./ChessBoard'), {
  ssr: false,
});

// Game time in seconds for different time controls
const TIME_CONTROLS = {
  BULLET: 180,  // 3 minutes
  BLITZ: 300,   // 5 minutes
  RAPID: 600    // 10 minutes
};

export default function ChessBoardWrapper() {
  // Mock game ID - in a real app this would come from the game state
  const gameId = 'mock-game-id-123';
  
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState | null>(null);
  const { socket } = useSocket();
  const { soundEnabled } = useSound();
  
  // Captured pieces state
  const [capturedByWhite, setCapturedByWhite] = useState<CapturedPiece[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<CapturedPiece[]>([]);
  
  // Game state
  const [gameState, setGameState] = useState({
    hasStarted: true,
    isWhiteTurn: true,
    hasWhiteMoved: false,
    isGameOver: false,
    gameResult: '',
    timeControl: 'RAPID' // Default time control
  });
  
  // Draw offer state
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferTimeRemaining, setDrawOfferTimeRemaining] = useState(30);
  const [drawOfferTimeout, setDrawOfferTimeout] = useState<NodeJS.Timeout | null>(null);

  // Preload sound effects when component mounts
  useEffect(() => {
    preloadSoundEffects(soundEnabled);
  }, [soundEnabled]);
  
  // Track captured pieces
  useEffect(() => {
    if (!moveHistory) return;
    
    const updateCapturedPieces = () => {
      try {
        // Get the current position from Chess.js
        const chess = getChessEngine();
        const board = chess.board();
        
        // Count pieces on the board
        const piecesOnBoard = {
          'wp': 0, 'wn': 0, 'wb': 0, 'wr': 0, 'wq': 0, 'wk': 0,
          'bp': 0, 'bn': 0, 'bb': 0, 'br': 0, 'bq': 0, 'bk': 0
        };
        
        // Count pieces on the board
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
              const key = piece.color + piece.type;
              piecesOnBoard[key as keyof typeof piecesOnBoard]++;
            }
          }
        }
        
        // Initial pieces counts
        const initialPieces = {
          'wp': 8, 'wn': 2, 'wb': 2, 'wr': 2, 'wq': 1, 'wk': 1,
          'bp': 8, 'bn': 2, 'bb': 2, 'br': 2, 'bq': 1, 'bk': 1
        };
        
        // Calculate captured pieces
        const newCapturedByWhite: CapturedPiece[] = [];
        const newCapturedByBlack: CapturedPiece[] = [];
        
        // Map from chess.js piece notation to our piece types
        const pieceTypeMap: Record<string, 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'> = {
          'p': 'pawn',
          'n': 'knight',
          'b': 'bishop',
          'r': 'rook',
          'q': 'queen',
          'k': 'king'
        };
        
        // Calculate pieces captured by white (black pieces missing from board)
        Object.entries(initialPieces)
          .filter(([key]) => key.startsWith('b')) // Only black pieces
          .forEach(([key, count]) => {
            const pieceType = key[1];
            const onBoardCount = piecesOnBoard[key as keyof typeof piecesOnBoard];
            const capturedCount = count - onBoardCount;
            
            for (let i = 0; i < capturedCount; i++) {
              newCapturedByWhite.push({
                type: pieceTypeMap[pieceType],
                color: 'black',
                id: `black-${pieceType}-${i}-${Date.now()}`
              });
            }
          });
        
        // Calculate pieces captured by black (white pieces missing from board)
        Object.entries(initialPieces)
          .filter(([key]) => key.startsWith('w')) // Only white pieces
          .forEach(([key, count]) => {
            const pieceType = key[1];
            const onBoardCount = piecesOnBoard[key as keyof typeof piecesOnBoard];
            const capturedCount = count - onBoardCount;
            
            for (let i = 0; i < capturedCount; i++) {
              newCapturedByBlack.push({
                type: pieceTypeMap[pieceType],
                color: 'white',
                id: `white-${pieceType}-${i}-${Date.now()}`
              });
            }
          });
        
        // Update state
        setCapturedByWhite(newCapturedByWhite);
        setCapturedByBlack(newCapturedByBlack);
      } catch (error) {
        console.error('Error updating captured pieces:', error);
      }
    };
    
    // Update captured pieces whenever move history changes
    updateCapturedPieces();
  }, [moveHistory]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for draw offers
    socket.on('offer_draw', () => {
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
    
    // Check game status after every move
    const status = getGameStatus();
    
    // Update game state based on chess.js status
    setGameState(prev => ({ 
      ...prev,
      isWhiteTurn: status.turn === 'white',
      hasWhiteMoved: true,
      isGameOver: status.isGameOver,
      gameResult: getGameResult(status),
    }));
    
    // Update active player for clocks
    if (status.isGameOver) {
      setActivePlayer(null); // Stop both clocks
    } else {
      setActivePlayer(status.turn === 'white' ? 'white' : 'black'); // Set the active player based on whose turn it is
    }
    
    // If a move is made, notify the server
    if (history.moves.length > 0 && history.currentMoveIndex === history.moves.length - 1) {
      const lastMove = history.moves[history.currentMoveIndex];
      
      if (socket) {
        socket.emit('move_made', {
          gameId,
          from: lastMove.from,
          to: lastMove.to,
          player: lastMove.piece.color,
          notation: lastMove.notation,
        });
      }
    }
  }, [socket, gameId]);
  
  // Get a human-readable game result string
  const getGameResult = (status: ReturnType<typeof getGameStatus>): string => {
    if (status.isCheckmate) {
      return `Checkmate! ${status.turn === 'white' ? 'Black' : 'White'} wins`;
    } else if (status.isStalemate) {
      return 'Draw by stalemate';
    } else if (status.isDraw) {
      return 'Draw';
    } else if (status.isGameOver) {
      return 'Game over';
    }
    return '';
  };
  
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
  
  // State to track active player (in a real game, this would be derived from game state)
  const [activePlayer, setActivePlayer] = useState<'white' | 'black' | null>('white');
  
  // Get the current time control time in seconds
  const getTimeControlSeconds = () => {
    return TIME_CONTROLS[gameState.timeControl as keyof typeof TIME_CONTROLS] || TIME_CONTROLS.RAPID;
  };
  
  // Mock handler for time out events
  const handleTimeOut = (player: 'white' | 'black') => {
    console.log(`${player} player ran out of time`);
    setActivePlayer(null); // Stop both clocks
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
      gameResult: `Time out! ${player === 'white' ? 'Black' : 'White'} wins`,
    }));
    
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
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
      gameResult: 'Draw by agreement',
    }));
    
    // Stop the clocks
    setActivePlayer(null);
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

  // Handle resigning from the game
  const handleResign = useCallback(() => {
    if (!socket) return;
    
    socket.emit('resign', { gameId });
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
      gameResult: `${gameState.isWhiteTurn ? 'White' : 'Black'} resigned. ${gameState.isWhiteTurn ? 'Black' : 'White'} wins`,
    }));
    
    // Stop the clocks
    setActivePlayer(null);
  }, [socket, gameId, gameState.isWhiteTurn]);

  // Handle offering a draw
  const handleOfferDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('offer_draw', { gameId });
  }, [socket, gameId]);

  // Handle aborting the game
  const handleAbortGame = useCallback(() => {
    if (!socket || gameState.hasWhiteMoved) return;
    
    socket.emit('abort_game', { gameId });
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
      gameResult: 'Game aborted',
    }));
    
    // Stop the clocks
    setActivePlayer(null);
  }, [socket, gameId, gameState.hasWhiteMoved]);

  // Get the time for the clocks
  const gameTimeInSeconds = getTimeControlSeconds();

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
      
      {/* Game Result Display */}
      {gameState.isGameOver && (
        <div className="p-4 my-2 bg-amber-100 rounded-md text-center font-bold">
          {gameState.gameResult}
        </div>
      )}
      
      {/* Player 1 Info (Top) with Timer */}
      <div className="flex justify-between items-center mb-2">
        <PlayerInfo 
          position="top"
          username={player1.username}
          rating={player1.rating}
          clubAffiliation={player1.clubAffiliation}
          isGuest={player1.isGuest}
          capturedPieces={capturedByBlack}
        />
        {/* Top player timer (Black) */}
        <div className="mr-2">
          <GameClock 
            timeInSeconds={gameTimeInSeconds}
            isActive={activePlayer === 'black'}
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
          capturedPieces={capturedByWhite}
        />
        {/* Bottom player timer (White) */}
        <div className="mr-2">
          <GameClock 
            timeInSeconds={gameTimeInSeconds}
            isActive={activePlayer === 'white'}
            isDarkTheme={true}
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
        onResign={handleResign}
        onOfferDraw={handleOfferDraw}
        onAbortGame={handleAbortGame}
      />
    </div>
  );
} 