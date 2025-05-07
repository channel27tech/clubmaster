'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
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
import DisconnectionNotification from './DisconnectionNotification';

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

// Function to convert time string from backend to seconds
const getTimeInSeconds = (timeControlStr: string): number => {
  // Expected format: "3+0", "5+0", "10+0"
  const mainTime = timeControlStr.split('+')[0];
  // Convert to minutes then to seconds
  return parseInt(mainTime) * 60;
};

interface ChessBoardWrapperProps {
  playerColor?: 'white' | 'black' | null;
  timeControl?: string;
  gameId?: string;
}

export default function ChessBoardWrapper({ playerColor, timeControl = '5+0', gameId = '' }: ChessBoardWrapperProps) {
  // Get game ID from props or use derived from URL if available
  const [gameRoomId, setGameRoomId] = useState<string>(gameId);
  
  // useEffect to get gameId from URL if not provided as prop
  useEffect(() => {
    if (!gameRoomId && typeof window !== 'undefined') {
      // Extract gameId from URL /game/[gameId]
      const pathParts = window.location.pathname.split('/');
      const urlGameId = pathParts[pathParts.length - 1];
      if (urlGameId && urlGameId !== 'game') {
        setGameRoomId(urlGameId);
        console.log('Using gameId from URL:', urlGameId);
      }
    }
  }, [gameRoomId]);
  
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
    timeControl: timeControl || '5+0' // Use passed timeControl or default
  });
  
  // Update gameState.timeControl when timeControl prop changes
  useEffect(() => {
    if (timeControl) {
      setGameState(prev => ({
        ...prev,
        timeControl: timeControl
      }));
      console.log('Updated timeControl to:', timeControl);
    }
  }, [timeControl]);
  
  // Calculate time in seconds based on the time control string
  const gameTimeInSeconds = useMemo(() => {
    console.log('Calculating time from:', gameState.timeControl);
    // Direct mapping for known values for reliability
    if (gameState.timeControl === '3+0') return 180;
    if (gameState.timeControl === '5+0') return 300;
    if (gameState.timeControl === '10+0') return 600;
    
    // Fallback to parsing
    return getTimeInSeconds(gameState.timeControl);
  }, [gameState.timeControl]);
  
  // Draw offer state
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferTimeRemaining, setDrawOfferTimeRemaining] = useState(30);
  const [drawOfferTimeout, setDrawOfferTimeout] = useState<NodeJS.Timeout | null>(null);

  // Add disconnection states
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedPlayerName, setDisconnectedPlayerName] = useState('');
  const [reconnectionTimeRemaining, setReconnectionTimeRemaining] = useState(120); // 2 minutes in seconds
  const [maxReconnectionTime, setMaxReconnectionTime] = useState(120);
  const [reconnectionTimerId, setReconnectionTimerId] = useState<NodeJS.Timeout | null>(null);

  // Define captured pieces for each player
  const [whiteCapturedPieces, setWhiteCapturedPieces] = useState<any[]>([]);
  const [blackCapturedPieces, setBlackCapturedPieces] = useState<any[]>([]);

  // For this demo, we'll copy pieces from mock data
  useEffect(() => {
    setWhiteCapturedPieces(player1.capturedPieces);
    setBlackCapturedPieces(player2.capturedPieces);
  }, []);

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
        
        // Adjust for promotions - track all pawn promotions from move history
        const promotions: { fromColor: string, toType: string }[] = [];
        if (moveHistory.moves) {
          moveHistory.moves.forEach(move => {
            if (move.promotion) {
              const fromColor = move.piece.color === 'white' ? 'w' : 'b';
              const toType = move.promotion === 'queen' ? 'q' : 
                             move.promotion === 'rook' ? 'r' : 
                             move.promotion === 'bishop' ? 'b' : 
                             move.promotion === 'knight' ? 'n' : '';
              
              if (toType) {
                promotions.push({ fromColor, toType });
              }
            }
          });
        }
        
        // Adjust initial counts based on promotions
        promotions.forEach(({ fromColor, toType }) => {
          // Decrement pawn count
          const pawnKey = `${fromColor}p` as keyof typeof initialPieces;
          initialPieces[pawnKey]--;
          
          // Increment promoted piece count
          const pieceKey = `${fromColor}${toType}` as keyof typeof initialPieces;
          initialPieces[pieceKey]++;
        });
        
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
        socket.emit('decline_draw', { gameId: gameRoomId });
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

    // Add disconnection event handlers
    socket.on('opponent_disconnected', ({ playerId, reconnectTimeoutSeconds }) => {
      // Determine which player disconnected and set their name
      const isPlayer1 = playerId === player1.id;
      const disconnectedPlayer = isPlayer1 ? player1 : player2;
      
      setDisconnectedPlayerName(disconnectedPlayer.username);
      setOpponentDisconnected(true);
      
      // Set the reconnection time limit (either 2 minutes or remaining time on clock, whichever is less)
      const timeLimit = Math.min(reconnectTimeoutSeconds, 120);
      setMaxReconnectionTime(timeLimit);
      setReconnectionTimeRemaining(timeLimit);
      
      // Play disconnection sound
      playSound('NOTIFICATION', soundEnabled);
      
      // Start countdown timer
      const timerId = setInterval(() => {
        setReconnectionTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setReconnectionTimerId(timerId);
    });
    
    socket.on('opponent_reconnected', () => {
      // Clear disconnection state and timers
      setOpponentDisconnected(false);
      
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
        setReconnectionTimerId(null);
      }
      
      // Play reconnection sound
      playSound('GAME_START', soundEnabled);
    });
    
    socket.on('game_timeout_disconnection', ({ winnerId, loserId, reason }) => {
      // Handle game ending due to disconnection timeout
      const isWinner = socket.id === winnerId;
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
        gameResult: `Game ended: ${reason}. ${isWinner ? 'You win!' : 'You lose.'}`,
      }));
      
      // Clear disconnection state
      setOpponentDisconnected(false);
      
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
        setReconnectionTimerId(null);
      }
      
      // Stop both clocks
      setActivePlayer(null);
      
      // Play game end sound
      playSound('GAME_END', soundEnabled);
    });

    // Listen for game aborted event
    socket.on('game_aborted', ({ gameId: abortedGameId, reason }) => {
      if (gameRoomId === abortedGameId) {
        // Update game state to reflect abort
        setGameState(prevState => ({
          ...prevState,
          isGameOver: true,
          gameResult: `Game Aborted: ${reason}`,
        }));

        // Stop both clocks when game is aborted
        setActivePlayer(null);

        // Play notification sound
        playSound('NOTIFICATION', soundEnabled);

        console.log(`Game ${gameRoomId} has been aborted. Reason: ${reason}`);
      }
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
      
      // Cleanup disconnection event listeners
      socket.off('opponent_disconnected');
      socket.off('opponent_reconnected');
      socket.off('game_timeout_disconnection');
      
      // Clear any existing timeouts
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
      }

      socket.off('game_aborted');
    };
  }, [socket, gameRoomId, drawOfferTimeout, reconnectionTimerId, soundEnabled, player1, player2]);
  
  // Handle move history updates from the ChessBoard component
  const handleMoveHistoryChange = useCallback((history: MoveHistoryState) => {
    setMoveHistory(history);
    
    // Update captured pieces based on the current move
    if (history.moves.length > 0 && history.currentMoveIndex >= 0) {
      const currentMove = history.moves[history.currentMoveIndex];
      if (currentMove.boardState && currentMove.boardState.capturedPieces) {
        setWhiteCapturedPieces(currentMove.boardState.capturedPieces.white);
        setBlackCapturedPieces(currentMove.boardState.capturedPieces.black);
      }
    } else if (history.currentMoveIndex === -1) {
      // At initial position, reset captured pieces
      setWhiteCapturedPieces([]);
      setBlackCapturedPieces([]);
    }
    
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
          gameId: gameRoomId,
          from: lastMove.from,
          to: lastMove.to,
          player: lastMove.piece.color,
          notation: lastMove.notation,
        });
      }
    }
  }, [socket, gameRoomId]);
  
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
  
  // Debug values
  useEffect(() => {
    console.log('ChessBoardWrapper received playerColor:', playerColor);
    console.log('ChessBoardWrapper using timeControl:', gameState.timeControl);
    console.log('Calculated game time in seconds:', gameTimeInSeconds);
    console.log('Using gameId:', gameRoomId);
  }, [playerColor, gameState.timeControl, gameTimeInSeconds, gameRoomId]);
  
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
    
    socket.emit('accept_draw', { gameId: gameRoomId });
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
  }, [socket, gameRoomId, drawOfferTimeout, soundEnabled]);

  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('decline_draw', { gameId: gameRoomId });
    setDrawOfferReceived(false);
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabled);
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameRoomId, drawOfferTimeout, soundEnabled]);

  // Handle resigning from the game
  const handleResign = useCallback(() => {
    if (!socket) return;
    
    socket.emit('resign', { gameId: gameRoomId });
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
      gameResult: `${gameState.isWhiteTurn ? 'White' : 'Black'} resigned. ${gameState.isWhiteTurn ? 'Black' : 'White'} wins`,
    }));
    
    // Stop the clocks
    setActivePlayer(null);
  }, [socket, gameRoomId, gameState.isWhiteTurn]);

  // Handle offering a draw
  const handleOfferDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('offer_draw', { gameId: gameRoomId });
  }, [socket, gameRoomId]);

  // Handle aborting the game
  const handleAbortGame = () => {
    if (!socket || !gameRoomId) return;

    // Log abort attempt
    console.log(`Attempting to abort game ${gameRoomId}`);

    // Emit abort_game event with gameId
    socket.emit('abort_game', { gameId: gameRoomId });

    // Play sound
    playSound('BUTTON_CLICK', soundEnabled);
  };

  // When gameRoomId changes, join the socket room
  useEffect(() => {
    if (socket && gameRoomId) {
      console.log(`Joining game room: ${gameRoomId}`);
      // Use the explicit join_game_room handler
      socket.emit('join_game_room', { gameId: gameRoomId });
      
      // Listen for confirmation of joining the room
      const handleJoinedRoom = (data: { gameId: string, playerId: string }) => {
        console.log(`Successfully joined game room ${data.gameId} as player ${data.playerId}`);
      };
      
      socket.on('joined_game_room', handleJoinedRoom);
      
      // Cleanup
      return () => {
        socket.off('joined_game_room', handleJoinedRoom);
      };
    }
  }, [socket, gameRoomId]);

  return (
    <div className="flex flex-col w-full h-full rounded-t-xl rounded-b-none sm:rounded-t-xl sm:rounded-b-none overflow-hidden flex-shrink-0" style={{ backgroundColor: '#4A7C59' }}>
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
      
      {/* Determine which player is at top/bottom based on perspective */}
      {playerColor === 'black' ? (
        <>
          {/* Player 1 Info (Top) - White */}
          <div className="flex justify-between items-center mb-2">
            <PlayerInfo 
              position="top"
              username={player1.username}
              rating={player1.rating}
              clubAffiliation={player1.clubAffiliation}
              isGuest={player1.isGuest}
              capturedPieces={capturedByWhite || whiteCapturedPieces}
            />
            {/* Top player timer (White) */}
            <div className="mr-2">
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'white'}
                isDarkTheme={false}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
              />
            </div>
          </div>
          
          {/* Chess Board */}
          <ChessBoard 
            perspective={playerColor || 'white'}
            onMoveHistoryChange={handleMoveHistoryChange}
            playerColor={playerColor}
          />
      
          {/* Player 2 Info (Bottom) - Black */}
          <div className="flex justify-between items-center mt-2">
            <PlayerInfo 
              position="bottom"
              username={player2.username}
              rating={player2.rating}
              clubAffiliation={player2.clubAffiliation}
              isGuest={player2.isGuest}
              capturedPieces={capturedByBlack || blackCapturedPieces}
            />
            {/* Bottom player timer (Black) */}
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
        </>
      ) : (
        <>
          {/* Player 2 Info (Top) - Black */}
          <div className="flex justify-between items-center mb-2">
            <PlayerInfo 
              position="top"
              username={player2.username}
              rating={player2.rating}
              clubAffiliation={player2.clubAffiliation}
              isGuest={player2.isGuest}
              capturedPieces={capturedByBlack || blackCapturedPieces}
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
            perspective={playerColor || 'white'}
            onMoveHistoryChange={handleMoveHistoryChange}
            playerColor={playerColor}
          />
      
          {/* Player 1 Info (Bottom) - White */}
          <div className="flex justify-between items-center mt-2">
            <PlayerInfo 
              position="bottom"
              username={player1.username}
              rating={player1.rating}
              clubAffiliation={player1.clubAffiliation}
              isGuest={player1.isGuest}
              capturedPieces={capturedByWhite || whiteCapturedPieces}
            />
            {/* Bottom player timer (White) */}
            <div className="mr-2">
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'white'}
                isDarkTheme={false}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
              />
            </div>
          </div>
        </>
      )}
      
      {/* Move Controls */}
      <MoveControls
        onBack={handleBackClick}
        onForward={handleForwardClick}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        gameId={gameRoomId}
        gameState={gameState}
        onResign={handleResign}
        onOfferDraw={handleOfferDraw}
        onAbortGame={handleAbortGame}
      />
      
      {/* Disconnection Notification */}
      {opponentDisconnected && (
        <DisconnectionNotification
          gameId={gameRoomId}
          playerId={disconnectedPlayerName}
          reconnectTimeoutSeconds={reconnectionTimeRemaining}
        />
      )}
    </div>
  );
} 