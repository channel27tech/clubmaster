'use client';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import PlayerInfo from './PlayerInfo';
import MoveControls from './MoveControls';
import GameClock from './GameClock';
import GameResultScreen from './GameResultScreen';
import { player1, player2 } from '../utils/mockData';
import { MoveHistoryState } from '../utils/moveHistory';
import { getGameStatus, getChessEngine, getFen, setChessPosition } from '../utils/chessEngine';
import { useSound } from '../../contexts/SoundContext';
import { useSocket } from '../../contexts/SocketContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';
import { CapturedPiece, GameResultType, GameEndReason } from '../utils/types';
import DisconnectionNotification from './DisconnectionNotification';

// Use dynamic import in a client component
const ChessBoard = dynamic(() => import('./ChessBoard'), {
  ssr: false,
});

// Function to convert time string from backend to seconds
const getTimeInSeconds = (timeControlStr: string): number => {
  try {
    // Expected format: "3+0", "5+0", "10+0"
    const mainTimePart = timeControlStr.split('+')[0];
    const minutes = parseInt(mainTimePart);
    
    // Direct mapping for known values for reliability
    if (minutes === 3) return 180; // 3 minutes
    if (minutes === 5) return 300; // 5 minutes
    if (minutes === 10) return 600; // 10 minutes
    
    // Fallback calculation for other values
    return minutes * 60;
  } catch (error) {
    console.error('Error parsing time control string:', error);
    return 300; // Default to 5 minutes (300 seconds)
  }
};

// Map a timeControl string to a game mode
const getGameModeFromTimeControl = (timeControlStr: string): string => {
  try {
    const minutes = parseInt(timeControlStr.split('+')[0]);
    // Exact matches first
    if (minutes === 3) return 'Bullet';
    if (minutes === 5) return 'Blitz';
    if (minutes === 10) return 'Rapid';
    // Fallback ranges
    if (minutes <= 3) return 'Bullet';
    if (minutes <= 5) return 'Blitz';
    return 'Rapid';
  } catch (error) {
    console.error('Error mapping time control to game mode:', error);
    return 'Blitz'; // Default fallback
  }
};

interface ChessBoardWrapperProps {
  playerColor?: 'white' | 'black' | null;
  timeControl?: string;
  gameId?: string;
  onSanMoveListChange?: (sanMoves: string[]) => void;
}

export default function ChessBoardWrapper({ playerColor, timeControl = '5+0', gameId = '', onSanMoveListChange }: ChessBoardWrapperProps) {
  // Get game ID from props or use derived from URL if available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [gameRoomId, setGameRoomId] = useState<string>(gameId);
  
  // Socket context for real-time communication
  const { socket } = useSocket();
  
  // Sound context
  const { soundEnabled } = useSound();
  
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState | null>(null);
  const [sanMoveList, setSanMoveList] = useState<string[]>([]);
  
  // Captured pieces state
  const [capturedByWhite, setCapturedByWhite] = useState<CapturedPiece[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<CapturedPiece[]>([]);
  
  // Active player for timers
  const [activePlayer, setActivePlayer] = useState<'white' | 'black' | null>('white');
  
  // Game state
  const [gameState, setGameState] = useState({
    hasStarted: true,
    isWhiteTurn: true,
    hasWhiteMoved: false,
    isGameOver: false,
    timeControl: timeControl || '5+0', // Use passed timeControl or default
    gameMode: getGameModeFromTimeControl(timeControl || '5+0') // Derive game mode from time control
  });
  
  // Add debugging log when component first renders
  useEffect(() => {
    console.log('ChessBoardWrapper initial gameState with hasWhiteMoved=false:', gameState);
  }, []);
  
  // Debug gameState.hasWhiteMoved changes
  useEffect(() => {
    console.log('DEBUG ChessBoardWrapper - hasWhiteMoved changed:', {
      hasWhiteMoved: gameState.hasWhiteMoved,
      moveHistory: moveHistory ? {
        length: moveHistory?.moves?.length,
        currentMoveIndex: moveHistory?.currentMoveIndex
      } : 'null',
      canAbortGame: !gameState.hasWhiteMoved && (!moveHistory || !moveHistory.moves || moveHistory.moves.length === 0)
    });
  }, [gameState.hasWhiteMoved, moveHistory]);
  
  // Update gameState when timeControl prop changes
  useEffect(() => {
    if (timeControl) {
      const gameMode = getGameModeFromTimeControl(timeControl);
      setGameState(prev => ({
        ...prev,
        timeControl: timeControl,
        gameMode: gameMode
      }));
      console.log(`Updated timeControl to: ${timeControl}, game mode: ${gameMode}`);
      
      // Validate time control format
      if (!timeControl.match(/^\d+\+\d+$/)) {
        console.warn('Invalid time control format:', timeControl);
      }
    }
  }, [timeControl]);
  
  // Listen for game state updates from the server
  useEffect(() => {
    // Define listener for game state updates
    const handleGameStateUpdated = (event: CustomEvent) => {
      console.log('Game state update received:', event.detail);
      
      // Update local game state with the received state
      setGameState(prev => ({
        ...prev,
        hasWhiteMoved: event.detail.hasWhiteMoved,
        isWhiteTurn: event.detail.isWhiteTurn,
        hasStarted: event.detail.hasStarted,
        isGameOver: event.detail.isGameOver
      }));
    };
    
    // Add the event listener
    window.addEventListener('game_state_updated', handleGameStateUpdated as EventListener);
    
    // Clean up when component unmounts
    return () => {
      window.removeEventListener('game_state_updated', handleGameStateUpdated as EventListener);
    };
  }, []);
  
  // Calculate time in seconds based on the time control string
  const gameTimeInSeconds = useMemo(() => {
    if (!timeControl) return 300; // Default to 5 minutes
    console.log('Calculating time from:', timeControl);
    const seconds = getTimeInSeconds(timeControl);
    console.log('Calculated seconds:', seconds);
    return seconds;
  }, [timeControl]);
  
  // Draw offer state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [drawOfferTimeRemaining, setDrawOfferTimeRemaining] = useState(30);
  const [drawOfferTimeout, setDrawOfferTimeout] = useState<NodeJS.Timeout | null>(null);

  // Add disconnection states
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectedPlayerName, setDisconnectedPlayerName] = useState('');
  const [reconnectionTimeRemaining, setReconnectionTimeRemaining] = useState(120); // 2 minutes in seconds
  const [reconnectionTimerId, setReconnectionTimerId] = useState<NodeJS.Timeout | null>(null);

  // Define captured pieces for each player
  const [whiteCapturedPieces, setWhiteCapturedPieces] = useState<CapturedPiece[]>([]);
  const [blackCapturedPieces, setBlackCapturedPieces] = useState<CapturedPiece[]>([]);

  // For this demo, we'll copy pieces from mock data
  useEffect(() => {
    setWhiteCapturedPieces(player1.capturedPieces as CapturedPiece[]);
    setBlackCapturedPieces(player2.capturedPieces as CapturedPiece[]);
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
    
    const safeSocket = socket;
    
    // Keep track of last established turn state with timestamps
    // This helps prevent issues when other WebSocket operations like sound settings occur
    const gameStateTracker = {
      isWhiteTurn: true,
      hasStarted: false,
      lastUpdateTime: Date.now(),
      // Store player turn by color for reliable referencing
      activePlayer: 'white' as 'white' | 'black' | null,
      // Store a reference to the active interval to prevent duplicates
      stateCheckInterval: null as NodeJS.Timeout | null
    };

    // Listen for draw offers
    safeSocket.on('offer_draw', () => {
      setDrawOfferReceived(true);
      
      // Play notification sound if enabled
      if (soundEnabled) {
        playSound('NOTIFICATION', true);
      }
      
      // Set a timeout to auto-decline after 30 seconds
      const timeout = setTimeout(() => {
        setDrawOfferReceived(false);
        safeSocket.emit('decline_draw', { gameId: gameRoomId });
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
    safeSocket.on('game_started', () => {
      gameStateTracker.hasStarted = true;
      gameStateTracker.lastUpdateTime = Date.now();
      
      setGameState(prev => ({ 
        ...prev, 
        hasStarted: true 
      }));
      
      // Play game start sound if enabled
      if (soundEnabled) {
        playSound('GAME_START', true);
      }
    });
    
    safeSocket.on('move_made', ({ player, isCapture, isCheck }) => {
      // Update our game state tracker
      gameStateTracker.lastUpdateTime = Date.now();
      
      // First update game state
      if (player === 'white') {
        gameStateTracker.isWhiteTurn = false;
        gameStateTracker.activePlayer = 'black';
        
        setGameState(prev => ({ 
          ...prev, 
          isWhiteTurn: false,
          hasWhiteMoved: true 
        }));
        
        // Also ensure activePlayer state is synchronized
        setActivePlayer('black');
      } else {
        gameStateTracker.isWhiteTurn = true;
        gameStateTracker.activePlayer = 'white';
        
        setGameState(prev => ({ 
          ...prev, 
          isWhiteTurn: true,
          // Always mark hasWhiteMoved as true after any move (even black's moves)
          hasWhiteMoved: true
        }));
        
        // Also ensure activePlayer state is synchronized
        setActivePlayer('white');
      }
      
      // Then play sounds if enabled
      if (soundEnabled) {
        if (isCheck) {
          playSound('CHECK', true);
        } else if (isCapture) {
          playSound('CAPTURE', true);
        } else {
          playSound('MOVE', true);
        }
      }
    });
    
    // Start a reliable state check interval 
    // This is critical to ensure clocks continue running after WebSocket operations
    if (gameStateTracker.stateCheckInterval === null) {
      gameStateTracker.stateCheckInterval = setInterval(() => {
        // Only verify if game has started and not ended
        if (gameStateTracker.hasStarted) {
          // Get current game state
          setGameState(prev => {
            // If the game is over, don't modify anything
            if (prev.isGameOver) return prev;
            
            // If it's been over 5 seconds since our last update, force a re-sync
            const needsForceUpdate = Date.now() - gameStateTracker.lastUpdateTime > 5000;
            
            // If no changes needed and not forcing update, return the same state to avoid re-renders
            if (prev.isWhiteTurn === gameStateTracker.isWhiteTurn && !needsForceUpdate) {
              return prev;
            }
            
            // Otherwise update to match the last known turn state
            console.log('⚠️ Correcting game clock state');
            return {
              ...prev,
              isWhiteTurn: gameStateTracker.isWhiteTurn
            };
          });
          
          // Also ensure activePlayer state is synchronized
          setActivePlayer(gameStateTracker.activePlayer);
        }
      }, 1000); // Check every second for more responsiveness
    }
    
    safeSocket.on('checkmate', (data) => {
      // Update game tracker state
      gameStateTracker.activePlayer = null;
      
      // Get winner and loser from data
      const isWinner = safeSocket.id === data.winnerSocketId;
      // Use isLoser in the result calculation to avoid unused variable warning
      const isLoser = safeSocket.id === data.loserSocketId;
      
      // Create result data 
      const resultData = {
        result: isWinner ? 'win' : (isLoser ? 'loss' : 'draw') as GameResultType,
        reason: 'checkmate' as GameEndReason,
        playerName: player1.username,
        opponentName: player2.username,
        playerRating: player1.rating || 1500,
        opponentRating: player2.rating || 1500,
        playerRatingChange: isWinner ? 10 : -10,
        opponentRatingChange: isWinner ? -10 : 10
      };
      
      // Set game result data and show result screen
      setGameResultData(resultData);
      setShowResultScreen(true);
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        isGameOver: true
      }));
      
      if (soundEnabled) {
        playSound('CHECKMATE', true);
      }
    });
    
    safeSocket.on('draw', () => {
      // Update game tracker state
      gameStateTracker.activePlayer = null;
      
      if (soundEnabled) {
        playSound('DRAW', true);
      }
    });
    
    // Clean up intervals and event listeners on unmount
    return () => {
      if (gameStateTracker.stateCheckInterval) {
        clearInterval(gameStateTracker.stateCheckInterval);
        gameStateTracker.stateCheckInterval = null;
      }
      
      // Clean up all event listeners to prevent memory leaks
      safeSocket.off('offer_draw');
      safeSocket.off('game_started');
      safeSocket.off('move_made');
      safeSocket.off('checkmate');
      safeSocket.off('draw');
    };
    
    // Add disconnection event handlers
    safeSocket.on('opponent_disconnected', ({ playerId, reconnectTimeoutSeconds }) => {
      // Determine which player disconnected and set their name
      const isPlayer1 = playerId === player1.id;
      const disconnectedPlayer = isPlayer1 ? player1 : player2;
      
      setDisconnectedPlayerName(disconnectedPlayer.username);
      setOpponentDisconnected(true);
      
      // Set the reconnection time limit (either 2 minutes or remaining time on clock, whichever is less)
      const timeLimit = Math.min(reconnectTimeoutSeconds, 120);
      setReconnectionTimeRemaining(timeLimit);
      
      // Play disconnection sound if enabled
      if (soundEnabled) {
        playSound('NOTIFICATION', true);
      }
      
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
    
    safeSocket.on('opponent_reconnected', () => {
      // Clear disconnection state and timers
      setOpponentDisconnected(false);
      
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
        setReconnectionTimerId(null);
      }
      
      // Play reconnection sound if enabled
      if (soundEnabled) {
        playSound('GAME_START', true);
      }
    });
    
    safeSocket.on('game_timeout_disconnection', ({ winnerId, reason }) => {
      // Handle game ending due to disconnection timeout
      const isWinner = safeSocket.id === winnerId;
      
      // Show appropriate message
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
        gameOverReason: reason || 'Disconnection'
      }));
      
      // Create game result data
      const resultData = {
        result: isWinner ? 'win' : 'loss' as GameResultType,
        reason: 'disconnection' as GameEndReason,
        playerName: player1.username,
        opponentName: player2.username,
        playerRating: player1.rating || 1500,
        opponentRating: player2.rating || 1500,
        playerRatingChange: isWinner ? 10 : -10,
        opponentRatingChange: isWinner ? -10 : 10
      };
      
      // Set result data and show result screen
      setGameResultData(resultData);
      setShowResultScreen(true);
      
      // Stop both clocks
      setActivePlayer(null);
      
      // Play game end sound
      if (soundEnabled) {
        playSound('GAME_END', true);
      }
    });

    // Listen for game aborted event
    safeSocket.on('game_aborted', ({ gameId: abortedGameId, reason }) => {
      if (gameRoomId === abortedGameId) {
        // Update game state to reflect abort
        setGameState(prevState => ({
          ...prevState,
          isGameOver: true,
        }));

        // Stop both clocks when game is aborted
        setActivePlayer(null);

        // Play notification sound
        if (soundEnabled) {
          playSound('NOTIFICATION', true);
        }

        // Set game result data for abort
        setGameResultData({
          result: 'draw',
          reason: 'abort',
          playerName: player1.username,
          opponentName: player2.username,
          playerRating: player1.rating || 1500,
          opponentRating: player2.rating || 1500,
          playerRatingChange: 0, // No rating change on abort
          opponentRatingChange: 0  // No rating change on abort
        });

        // Show the result screen
        setShowResultScreen(true);

        console.log(`Game ${gameRoomId} has been aborted. Reason: ${reason}`);
      }
    });

    // Listen for game resigned event
    safeSocket.on('gameResigned', ({ gameId: resignedGameId, winner, loser, resigning }) => {
      console.log(`=========== RECEIVED GAME RESIGNED EVENT ===========`);
      console.log(`Game resigned event received with gameId: ${resignedGameId}, current gameId: ${gameRoomId}`);
      console.log(`Winner socketId: ${winner}, Loser socketId: ${loser}, My socketId: ${safeSocket.id}, Resigning: ${resigning}`);
      
      if (gameRoomId === resignedGameId) {
        console.log('MATCHED GAME ID - Processing resignation event');
        
        // Update game state to reflect resignation
        setGameState(prevState => ({
          ...prevState,
          isGameOver: true,
        }));

        // Stop both clocks when game is resigned
        setActivePlayer(null);

        // Play notification sound
        if (soundEnabled) {
          playSound('GAME_END', true);
        }

        // Determine if current player is the winner or loser
        // Use multiple methods to determine winner/loser status for redundancy
        const isResigningPlayer = resigning === true;
        const isWinner = safeSocket.id === winner;
        const isLoser = safeSocket.id === loser || isResigningPlayer;
        
        // If neither match, fallback to comparing colors and last move
        let resultType: 'win' | 'loss' | 'draw' = isWinner ? 'win' : (isLoser ? 'loss' : 'draw');
        
        // Last resort fallback if we couldn't determine winner/loser
        if (!isWinner && !isLoser) {
          console.warn('Cannot determine winner/loser from socket IDs, using fallback logic');
          
          // For resignation, if we're not sure, fallback to the player who last moved as the winner
          // This is not perfect but better than showing nothing
          resultType = playerColor === 'white' ? 
            (!gameState.isWhiteTurn ? 'win' : 'loss') : 
            (gameState.isWhiteTurn ? 'win' : 'loss');
            
          console.log(`Fallback result determination: ${resultType}`);
        }

        // Get player names based on perspective (determined by the result)
        const myName = resultType === 'win' ? player1.username : player2.username;
        const opponentName = resultType === 'win' ? player2.username : player1.username;

        // Log the resulting data for debugging
        console.log('Creating game result data with:', {
          result: resultType,
          reason: 'resignation',
          myName,
          opponentName,
          isWinner,
          isLoser,
          isResigningPlayer
        });

        // Set game result data for resignation
        setGameResultData({
          result: resultType,
          reason: 'resignation',
          playerName: myName,
          opponentName: opponentName,
          playerRating: resultType === 'win' ? player1.rating || 1500 : player2.rating || 1500,
          opponentRating: resultType === 'win' ? player2.rating || 1500 : player1.rating || 1500,
          playerRatingChange: resultType === 'win' ? 10 : -10, 
          opponentRatingChange: resultType === 'win' ? -10 : 10
        });

        // Dispatch a game_ended event to ensure result screen shows
        console.log('Dispatching game_ended event for resignation from ChessBoardWrapper');
        try {
          const gameEndedEvent = new CustomEvent('game_ended', {
            detail: {
              reason: 'resignation',
              result: resultType,
              source: 'chessBoardWrapper',
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(gameEndedEvent);
        } catch (error) {
          console.error('Error dispatching game_ended event:', error);
        }

        // Forcefully attempt to show the result screen directly without delays
        setShowResultScreen(true);
        console.log('Result screen activated, showResultScreen set to true');
        
        // Also trigger with a delay as a fallback - try multiple times
        const showResultDelays = [200, 1000, 2000];
        showResultDelays.forEach(delay => {
          setTimeout(() => {
            if (!showResultScreen) {
              console.log(`FALLBACK ${delay}ms: Result screen not shown, forcing display`);
              setShowResultScreen(true);
              
              // Also dispatch another event as a backup
              try {
                window.dispatchEvent(new CustomEvent('game_ended', {
                  detail: {
                    reason: 'resignation',
                    result: resultType,
                    source: `chessBoardWrapper-fallback-${delay}`,
                    timestamp: Date.now()
                  }
                }));
              } catch (error) {
                console.error(`Error dispatching fallback game_ended event at ${delay}ms:`, error);
              }
            }
          }, delay);
        });

        console.log(`Game ${gameRoomId} has been resigned. Current player ${resultType === 'win' ? 'won' : 'lost'}.`);
      } else {
        console.log(`Ignored resign event for different game ID (received: ${resignedGameId}, current: ${gameRoomId})`);
      }
    });

    // Listen for game end events
    safeSocket.on('game_end', (data) => {
      console.log('========= RECEIVED GAME_END EVENT FROM SERVER =========', data);

      // Determine if this is a checkmate
      if (data.reason === 'checkmate') {
        console.log('Game ended due to checkmate - showing result screen');
        
        // Use winnerColor and loserColor to determine if this player won or lost
        console.log('Debugging playerColor value:', { playerColor });
        const isWinner = playerColor === data.winnerColor;
        const isLoser = playerColor === data.loserColor;
        const resultType: 'win' | 'loss' | 'draw' = isWinner ? 'win' : (isLoser ? 'loss' : 'draw');
        
        console.log('Color comparison for checkmate game_end event:', {
          playerColor,
          winnerColor: data.winnerColor,
          loserColor: data.loserColor,
          isWinner,
          isLoser,
          resultType
        });
        
        // Set game result data with explicit title and secondary text
        const resultData = {
          result: resultType,
          reason: 'checkmate' as GameEndReason,
          playerName: player1.username,
          opponentName: player2.username,
          playerRating: player1.rating || 1500,
          opponentRating: player2.rating || 1500,
          playerRatingChange: resultType === 'win' ? 10 : -10,
          opponentRatingChange: resultType === 'win' ? -10 : 10
        };
        setGameResultData(resultData);
        
        console.log('Setting game result data for checkmate:', resultData);
        
        // Update game state with specific win/loss message
        setGameState(prev => ({
          ...prev,
          isGameOver: true,
          gameResult: resultType === 'win' ? 'You Won by Checkmate!' : 'You Lost by Checkmate'
        }));
        
        // Stop clocks
        setActivePlayer(null);
        
        // Show result screen
        setShowResultScreen(true);
        console.log('Result screen activated for checkmate game_end event');
        
        // Force immediate rendering of GameResultScreen with correct result
        setTimeout(() => {
          setShowResultScreen(false);
          setTimeout(() => {
            setShowResultScreen(true);
            console.log('Forced re-render of result screen with result:', resultType);
          }, 100);
        }, 100);
        return;
      }

      // Determine if this is a resignation
      if (data.reason === 'resignation' || data.endReason === 'resignation') {
        console.log('Game ended due to resignation - showing result screen');
        
        // Determine winner/loser using multiple approaches for redundancy
        const mySocketId = safeSocket.id;
        const isWinner = mySocketId === data.winner || mySocketId === data.winnerId;
        const isLoser = mySocketId === data.loser || mySocketId === data.loserId;
        const resultType: 'win' | 'loss' | 'draw' = isWinner ? 'win' : (isLoser ? 'loss' : 'draw');
        
        // Create game result data
        const resultData = {
          result: resultType,
          reason: data.reason as GameEndReason,
          playerName: player1.username,
          opponentName: player2.username,
          playerRating: player1.rating || 1500,
          opponentRating: player2.rating || 1500,
          playerRatingChange: resultType === 'win' ? 10 : (resultType === 'loss' ? -10 : 0),
          opponentRatingChange: resultType === 'win' ? -10 : (resultType === 'loss' ? 10 : 0)
        };
        
        // Set game result data
        setGameResultData(resultData);
        
        // Update game state
        setGameState(prev => ({
          ...prev,
          isGameOver: true,
        }));
        
        // Stop clocks
        setActivePlayer(null);
        
        // Show result screen
        setShowResultScreen(true);
        console.log('Result screen activated for game_end event');
      }
    });

    return () => {
      safeSocket.off('offer_draw');
      safeSocket.off('game_started');
      safeSocket.off('move_made');
      safeSocket.off('checkmate');
      safeSocket.off('draw');
      safeSocket.off('game_end');
      safeSocket.off('gameResigned');
      
      // Clear any existing timeouts
      if (drawOfferTimeout) {
        clearTimeout(drawOfferTimeout);
      }
      
      // Cleanup disconnection event listeners
      safeSocket.off('opponent_disconnected');
      safeSocket.off('opponent_reconnected');
      safeSocket.off('game_timeout_disconnection');
      
      // Clear any existing timeouts
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
      }

      safeSocket.off('game_aborted');
    };
  }, [socket, soundEnabled, gameRoomId]);

  // Add redundant clock state synchronization
  useEffect(() => {
    // Sync activePlayer with gameState whiteTurn
    // This adds redundancy to ensure clocks work even if one state gets out of sync
    if (!gameState.isGameOver) {
      const newActivePlayer = gameState.isWhiteTurn ? 'white' : 'black';
      if (activePlayer !== newActivePlayer) {
        setActivePlayer(newActivePlayer);
      }
    }
  }, [gameState.isWhiteTurn, gameState.isGameOver, activePlayer]);

  // Add a specific stable reference for making moves
  // This helps ensure moves can be made even if other socket operations interrupt the connection
  const [moveQueue, setMoveQueue] = useState<Array<{from: string, to: string, promotion?: string}>>([]);
  
  // Dedicated effect for handling the move queue
  // This is completely separated from sound settings or other game state updates
  useEffect(() => {
    if (!socket || !moveQueue.length || !gameRoomId) return;
    
    const move = moveQueue[0];
    const currentSocket = socket; // Capture current socket to avoid closure issues
    
    // Create a function to handle a single move
    const processMoveWithRetry = async () => {
      try {
        console.log(`Processing move: ${move.from} to ${move.to} (Socket connected: ${currentSocket.connected})`);
        const currentPlayerColor = !gameState.isWhiteTurn ? 'white' : 'black'; // Invert since move is being made
        
        // Attempt to emit the move event
        currentSocket.emit('move_made', {
          gameId: gameRoomId,
          from: move.from,
          to: move.to,
          player: currentPlayerColor,
          promotion: move.promotion
        });
        
        // Log successful move emission
        console.log(`Move emitted successfully to server: ${move.from}-${move.to}`);
        
        // Remove this move from the queue
        setMoveQueue(prev => prev.slice(1));
      } catch (error) {
        console.error('Error processing move:', error);
        
        // If there's an error, try again after a short delay
        setTimeout(processMoveWithRetry, 500);
      }
    };
    
    // Execute immediately
    processMoveWithRetry();
  }, [socket, moveQueue, gameRoomId, gameState.isWhiteTurn]);

  // Effect to notify parent about SAN move list changes
  useEffect(() => {
    if (onSanMoveListChange) {
      onSanMoveListChange(sanMoveList);
    }
  }, [sanMoveList, onSanMoveListChange]);
  
  // Handle move history updates from the ChessBoard component
  const handleMoveHistoryChange = useCallback((history: MoveHistoryState) => {
    // 🧠 IMPORTANT: This function is critical for maintaining a consistent move tracker display
    // When a player rewinds moves (using Back button) and then a new move is made:
    // 1. The ChessBoard component correctly maintains the move history state by trimming future moves 
    //    and appending the new move (see fixes in ChessBoard.tsx)
    // 2. We need to send ALL moves to the MoveTracker for display, not just the active ones
    // 3. This ensures the move tracker shows the complete history even after rewinds & new moves
    
    setMoveHistory(history);
    
    if (history && history.moves && history.moves.length > 0) {
      // 🔄 FIX: When updating the move list for display, we need to:
      // 1. Use ALL moves in the history, not just up to currentMoveIndex
      // 2. Ensure we're sending the correct SAN notations to the MoveTracker

      // Extract notations from ALL moves in history
      // This ensures the move tracker always shows the complete game history
      const allSanMoves = history.moves.map(move => move.notation);
      
      // Get the current index from history for debugging
      const currentIndex = history.currentMoveIndex;
      
      // Log the state for debugging
      console.log('📊 Move Tracker Update Debug:', {
        totalMovesInHistory: history.moves.length,
        currentMoveIndex: currentIndex,
        movesBeingSentToTracker: allSanMoves.length
      });
      
      // Update the sanMoveList state with ALL moves
      setSanMoveList(prevSanMoveList => {
        if (JSON.stringify(prevSanMoveList) !== JSON.stringify(allSanMoves)) {
          return allSanMoves;
        }
        return prevSanMoveList;
      });
    } else {
      setSanMoveList(prevSanMoveList => {
        if (prevSanMoveList.length > 0) {
          return [];
        }
        return prevSanMoveList;
      });
    }

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
    
    // Handle checkmate immediately
    if (status.isCheckmate) {
      // Determine the winner based on whose turn it is
      // In chess, the player who can't move is in checkmate, so the other player wins
      const isCurrentPlayerWinner = (status.turn === 'white' && playerColor === 'black') || 
                                  (status.turn === 'black' && playerColor === 'white');
      
      // Create game result data for checkmate
      const resultData = {
        result: isCurrentPlayerWinner ? 'win' : 'loss' as 'win' | 'loss',
        reason: 'checkmate' as GameEndReason,
        playerName: player1.username,
        opponentName: player2.username,
        playerRating: player1.rating || 1500,
        opponentRating: player2.rating || 1500,
        playerRatingChange: isCurrentPlayerWinner ? 10 : -10,
        opponentRatingChange: isCurrentPlayerWinner ? -10 : 10
      };
      
      // Set the game result data and show result screen
      setGameResultData(resultData);
      setShowResultScreen(true);
      
      // Update game state
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
        isWhiteTurn: status.turn === 'white'
      }));
      
      // Stop both clocks
      setActivePlayer(null);
      
      // Play checkmate sound - only if sound is enabled
      if (soundEnabled) {
        playSound('CHECKMATE', true);
      }
      
      return;
    }
    
    // Update game state based on chess.js status
    setGameState(prev => ({ 
      ...prev,
      isWhiteTurn: status.turn === 'white',
      hasWhiteMoved: true,
      isGameOver: status.isGameOver,
    }));
    
    // If the game is over due to checkmate, stalemate, etc., show the result screen
    if (status.isGameOver) {
      // Determine the result
      let result: GameResultType = 'draw';
      let reason: GameEndReason = 'stalemate';
      
      if (status.isCheckmate) {
        // If it's checkmate, the current player (whose turn it is) lost
        result = status.turn === playerColor ? 'loss' : 'win';
        reason = 'checkmate';
      } else if (status.isDraw) {
        result = 'draw';
        reason = 'stalemate';
      }
      
      // Create result data
      const resultData = {
        result,
        reason,
        playerName: player1.username,
        opponentName: player2.username,
        playerRating: player1.rating || 1500,
        opponentRating: player2.rating || 1500,
        playerRatingChange: result === 'win' ? 10 : (result === 'loss' ? -10 : 0),
        opponentRatingChange: result === 'win' ? -10 : (result === 'loss' ? 10 : 0)
      };
      
      // Set result data and show the screen
      setGameResultData(resultData);
      setShowResultScreen(true);
    }
    
    // Update active player for clocks
    if (status.isGameOver) {
      setActivePlayer(null); // Stop both clocks
    } else {
      setActivePlayer(status.turn === 'white' ? 'white' : 'black'); // Set the active player based on whose turn it is
    }
    
    // If a move is made, add it to the move queue
    // This is critical for synchronizing moves between clients
    if (history.moves.length > 0 && history.currentMoveIndex === history.moves.length - 1) {
      const lastMove = history.moves[history.currentMoveIndex];
      
      // Add to move queue instead of directly emitting
      // This ensures moves are processed even if sound settings change
      console.log(`Adding move to queue: ${lastMove.from}-${lastMove.to}`);
      setMoveQueue(prev => [...prev, {
        from: lastMove.from,
        to: lastMove.to,
        promotion: lastMove.promotion
      }]);
    }
  }, [soundEnabled, playerColor, player1.username, player1.rating, player2.username, player2.rating]);
  
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
    
    // Emit timeout event to the server
    if (socket) {
      socket.emit('timeout_occurred', {
        gameId: gameRoomId,
        playerColor: player
      });
      console.log(`Emitted timeout_occurred event for ${player} in game ${gameRoomId}`);
    }
    
    // Use setState callback to avoid referencing current state directly
    setActivePlayer(() => null); // Stop both clocks
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
    
    // Create game result data for timeout
    const timeoutResultData = {
      result: player === playerColor ? 'loss' : 'win' as GameResultType,
      reason: 'timeout' as GameEndReason,
      playerName: player1.username,
      opponentName: player2.username,
      playerRating: player1.rating || 1500,
      opponentRating: player2.rating || 1500,
      playerRatingChange: player === playerColor ? -10 : 10,
      opponentRatingChange: player === playerColor ? 10 : -10
    };
    
    // Set result data and show result screen
    setGameResultData(timeoutResultData);
    setShowResultScreen(true);
    
    // Play time out sound
    if (soundEnabled) {
      playSound('GAME_END', true);
    }
    
    // Set game result data based on the player who timed out
    const resultType = playerColor === player ? 'loss' : 'win';
    setGameResultData({
      result: resultType as GameResultType,
      reason: 'timeout' as GameEndReason,
      playerName: player1.username,
      opponentName: player2.username,
      playerRating: player1.rating || 1500,
      opponentRating: player2.rating || 1500,
      playerRatingChange: resultType === 'win' ? 10 : -10,
      opponentRatingChange: resultType === 'win' ? -10 : 10
    });
    
    // Show result screen
    setShowResultScreen(true);
  };

  // Handle draw offer responses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAcceptDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('accept_draw', { gameId: gameRoomId });
    setDrawOfferReceived(false);
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Accept');
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
    
    // Update game state
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
    
    // Create game result data for draw
    const drawResultData = {
      result: 'draw' as GameResultType,
      reason: 'agreement' as GameEndReason,
      playerName: player1.username,
      opponentName: player2.username,
      playerRating: player1.rating || 1500,
      opponentRating: player2.rating || 1500,
      playerRatingChange: 0,
      opponentRatingChange: 0
    };
    
    // Set result data and show result screen
    setGameResultData(drawResultData);
    setShowResultScreen(true);
    
    // Stop the clocks
    setActivePlayer(null);
  }, [socket, gameRoomId, drawOfferTimeout, soundEnabled]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('decline_draw', { gameId: gameRoomId });
    setDrawOfferReceived(false);
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Decline');
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameRoomId, drawOfferTimeout, soundEnabled]);

  // Handle resignation from the current player
  const handleResignGame = () => {
    console.log('Handling resignation - emitting resign', { gameId });
    
    // Immediately update UI state for the resigning player
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
    
    // Create explicit game result data for the resigning player
    const resignResultData = {
      result: 'loss' as GameResultType, // Explicitly type as 'loss'
      reason: 'resignation' as GameEndReason,
      playerName: player1.username,
      opponentName: player2.username,
      playerRating: player1.rating || 1500,
      opponentRating: player2.rating || 1500,
      playerRatingChange: -10, // Always negative for resigner
      opponentRatingChange: 10  // Always positive for opponent
    };
    
    // Set result data and show result screen immediately
    setGameResultData(resignResultData);
    setShowResultScreen(true);
    
    // Emit the resignation to the server
    if (socket) {
      socket.emit('resign', { gameId });
      console.log('Emitted resign event');
    }
    
    // Stop clocks
    setActivePlayer(null);
    
    // Broadcast a local game_ended event with explicit result type
    const gameEndedEvent = new CustomEvent('game_ended', {
      detail: {
        reason: 'resignation',
        result: 'loss',  // Explicit result for the player who resigned
        source: 'local_resign',
        loserSocketId: socket?.id // Mark self as loser
      }
    });
    window.dispatchEvent(gameEndedEvent);
  };

  // Handle offering a draw
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    playSound('BUTTON_CLICK', soundEnabled, 1.0, 'Abort');
  };

  // When gameRoomId changes, join the socket room
  useEffect(() => {
    if (socket && gameRoomId) {
      console.log(`Joining game room: ${gameRoomId}`);
      
      // First emit enter_game to get the initial game state
      socket.emit('enter_game', { gameId: gameRoomId });
      
      // Then use the explicit join_game_room handler
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

  // When gameState.isGameOver changes, clear chess engine state if game is over
  useEffect(() => {
    if (gameState.isGameOver) {
      // Clear persistent chess state from localStorage to prevent issues in future games
      if (typeof window !== 'undefined') {
        localStorage.removeItem('chess_engine_state');
        console.log('Cleared chess engine state due to game end');
      }
    }
  }, [gameState.isGameOver]);

  // Add game result screen state
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [gameResultData, setGameResultData] = useState<{
    result: GameResultType;
    reason: GameEndReason;
    playerName: string;
    opponentName: string;
    playerRating: number;
    opponentRating: number;
    playerRatingChange: number;
    opponentRatingChange: number;
  } | null>(null);

  // Add handler to close game result screen
  const handleCloseResultScreen = useCallback(() => {
    setShowResultScreen(false);
    
    // Redirect to home or matchmaking page
    window.location.href = '/';
  }, []);

  // Listen for the game_ended custom event
  useEffect(() => {
    const handleGameEnded = (event: CustomEvent) => {
      const { reason, result, winnerSocketId, loserSocketId, source, winnerColor, loserColor } = event.detail;
      console.log('Game ended event received:', { 
        reason, 
        result, 
        winnerSocketId, 
        loserSocketId,
        source, 
        mySocketId: socket?.id,
        winnerColor,
        loserColor
      });
      
      let finalResult: GameResultType;
      
      // First, prioritize winnerColor and loserColor if available and playerColor is defined
      if (winnerColor && loserColor && playerColor) {
        if (playerColor === winnerColor) {
          finalResult = 'win';
          console.log('Result determined from winnerColor match: win');
        } else if (playerColor === loserColor) {
          finalResult = 'loss';
          console.log('Result determined from loserColor match: loss');
        } else {
          finalResult = 'draw';
          console.log('No color match found, defaulting to draw');
        }
      } else if (result === 'win' || result === 'loss' || result === 'draw') {
        // Use the result directly if it's valid
        finalResult = result as GameResultType;
        console.log(`Using provided result: ${finalResult}`);
      } else if (socket && (winnerSocketId || loserSocketId)) {
        // If we have socket IDs, use them to determine winner/loser
        if (winnerSocketId && socket.id === winnerSocketId) {
          finalResult = 'win';
          console.log('Result determined from winnerSocketId match: win');
        } else if (loserSocketId && socket.id === loserSocketId) {
          finalResult = 'loss';
          console.log('Result determined from loserSocketId match: loss');
        } else if (reason === 'resignation') {
          // For resignation with no match, default to loss
          finalResult = 'loss';
          console.log('Using fallback for resignation with no socket match: loss');
        } else {
          // Default to draw for other cases (not resignations)
          finalResult = 'draw';
          console.log('Using default fallback: draw (non-resignation event)');
        }
      } else {
        // Last resort default - special handling for resignation
        if (reason === 'resignation') {
          // For resignations, default to loss if still unknown 
          finalResult = 'loss'; 
          console.log('Last resort fallback for resignation: loss');
        } else {
          // For other reasons, default to draw
          finalResult = 'draw';
          console.log(`Last resort fallback for ${reason}: draw`);
        }
      }
      
      // Create game result data
      const resultData = {
        result: finalResult,
        reason: reason as GameEndReason,
        playerName: player1.username,
        opponentName: player2.username,
        playerRating: player1.rating || 1500,
        opponentRating: player2.rating || 1500,
        playerRatingChange: finalResult === 'win' ? 10 : (finalResult === 'loss' ? -10 : 0),
        opponentRatingChange: finalResult === 'win' ? -10 : (finalResult === 'loss' ? 10 : 0)
      };
      
      // Log the final game result data for debugging
      console.log('Final game result data:', resultData);
      
      // Set the game result data state
      setGameResultData(resultData);
      
      // Show the result screen
      setShowResultScreen(true);
      
      // Stop both clocks
      setActivePlayer(null);
      
      // Update game state with specific message based on result
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
        gameResult: reason === 'checkmate' ? (finalResult === 'win' ? 'YOU WON BY CHECKMATE' : 'YOU LOST BY CHECKMATE') : 
                    reason === 'timeout' ? (finalResult === 'win' ? 'YOU WON BY TIMEOUT' : 'YOU LOST BY TIMEOUT') :
                    reason === 'resignation' ? (finalResult === 'win' ? 'YOU WON BY RESIGNATION' : 'YOU LOST BY RESIGNATION') : 'Game Over'
      }));
    };
    
    // Add event listener
    window.addEventListener('game_ended', handleGameEnded as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('game_ended', handleGameEnded as EventListener);
    };
  }, [socket, playerColor]);

  // Add dedicated result screen visibility effect to ensure it shows when needed
  useEffect(() => {
    // If the game is over and we have result data but the screen isn't shown, show it
    if (gameState.isGameOver && gameResultData && !showResultScreen) {
      console.log('Game is over with result data but screen not showing - forcing display', {
        isGameOver: gameState.isGameOver,
        hasResultData: !!gameResultData,
        showResultScreen
      });
      setShowResultScreen(true);
    }
  }, [gameState.isGameOver, gameResultData, showResultScreen]);

  // Debug logging for move controls
  useEffect(() => {
    console.log('DEBUG ChessBoardWrapper - Move Controls Debug:', {
      hasWhiteMoved: gameState.hasWhiteMoved,
      moveHistory: moveHistory ? {
        length: moveHistory?.moves?.length,
        currentMoveIndex: moveHistory?.currentMoveIndex
      } : 'null',
      canAbortGame: !gameState.hasWhiteMoved && (!moveHistory || !moveHistory.moves || moveHistory.moves.length === 0)
    });
  }, [gameState.hasWhiteMoved, moveHistory, gameState]);

  // Add a socket health monitoring system
  useEffect(() => {
    if (!socket) return;
    
    const safeSocket = socket;
    let healthCheckInterval: NodeJS.Timeout | null = null;
    
    // Function to check socket health and reconnect if needed
    const checkSocketHealth = () => {
      console.log(`Socket health check - Connected: ${safeSocket.connected}, Has pending moves: ${moveQueue.length > 0}`);
      
      if (!safeSocket.connected && moveQueue.length > 0) {
        console.warn('Socket disconnected with pending moves - attempting reconnection');
        
        // Try to reconnect
        try {
          safeSocket.connect();
          
          // After reconnection, verify connection
          setTimeout(() => {
            if (safeSocket.connected) {
              console.log('Socket reconnected successfully');
            } else {
              console.error('Socket reconnection failed');
            }
          }, 1000);
        } catch (error) {
          console.error('Error reconnecting socket:', error);
        }
      }
    };
    
    // Start health check interval
    healthCheckInterval = setInterval(checkSocketHealth, 5000);
    
    // Clean up on unmount
    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
    };
  }, [socket, moveQueue.length]);

  // Add a stable reference to store the current board state
  // This prevents the board from resetting when sound settings change
  const stableBoardStateRef = useRef<{
    fen: string | null;
    moveHistory: MoveHistoryState | null;
    lastSoundToggleTime: number;
  }>({
    fen: null,
    moveHistory: null,
    lastSoundToggleTime: 0
  });
  
  // Update the stable reference whenever move history changes
  useEffect(() => {
    if (moveHistory) {
      // Store the current state in our stable reference
      stableBoardStateRef.current = {
        ...stableBoardStateRef.current,
        fen: getFen(),
        moveHistory: JSON.parse(JSON.stringify(moveHistory))
      };
      
      console.log('Updated stable board reference with current state:', stableBoardStateRef.current.fen);
    }
  }, [moveHistory]);
  
  // Track sound toggle operations
  useEffect(() => {
    // Record the time of the sound toggle
    stableBoardStateRef.current.lastSoundToggleTime = Date.now();
    console.log('Sound toggle detected, timestamp recorded:', stableBoardStateRef.current.lastSoundToggleTime);
    
    // If we have a stored board state, ensure it's preserved after the sound toggle
    if (stableBoardStateRef.current.fen) {
      // Use a small delay to ensure this runs after any potential board reset
      const timeoutId = setTimeout(() => {
        const currentFen = getFen();
        
        // If the current FEN is different from our stored reference (indicating a reset),
        // restore the correct board state
        if (currentFen !== stableBoardStateRef.current.fen) {
          console.log('Board state mismatch detected after sound toggle. Restoring from reference.');
          console.log('Current:', currentFen);
          console.log('Expected:', stableBoardStateRef.current.fen);
          
          // Restore the correct position
          if (stableBoardStateRef.current.fen) {
            setChessPosition(stableBoardStateRef.current.fen, gameId || undefined);
            
            // If we have move history, ensure it's restored as well
            if (stableBoardStateRef.current.moveHistory && moveHistory !== stableBoardStateRef.current.moveHistory) {
              setMoveHistory(stableBoardStateRef.current.moveHistory);
            }
          }
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [soundEnabled, gameId]);

  return (
    <div className="flex flex-col w-full h-full rounded-t-xl rounded-b-none sm:rounded-t-xl sm:rounded-b-none overflow-hidden flex-shrink-0 pb-[62px]" style={{ backgroundColor: '#4A7C59' }}>
      {/* Game Result Screen */}
      {showResultScreen && gameResultData && (
        <GameResultScreen
          result={gameResultData.result}
          reason={gameResultData.reason}
          playerName={gameResultData.playerName}
          opponentName={gameResultData.opponentName}
          playerRating={gameResultData.playerRating}
          opponentRating={gameResultData.opponentRating}
          playerRatingChange={gameResultData.playerRatingChange}
          opponentRatingChange={gameResultData.opponentRatingChange}
          onClose={handleCloseResultScreen}
        />
      )}
      
      {/* Draw Offer Notification */}
      {/* <DrawOfferNotification
        isOpen={drawOfferReceived}
        onAccept={handleAcceptDraw}
        onDecline={handleDeclineDraw}
        opponentName={player2.username}
        timeRemaining={drawOfferTimeRemaining}
      /> */}
      
      {/* Determine which player is at top/bottom based on perspective */}
      {playerColor === 'black' ? (
        <>
          {/* Player 1 Info (Top) - White */}
          <div className="flex justify-between items-center mb-4 sm:mb-2 mx-[21px]">
            <PlayerInfo 
              position="top"
              username={player1.username}
              rating={player1.rating}
              clubAffiliation={player1.clubAffiliation}
              isGuest={player1.isGuest}
              capturedPieces={capturedByWhite || whiteCapturedPieces}
        />
            {/* Top player timer (White) */}
            <div>
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
            gameId={gameRoomId}
      />
      
          {/* Player 2 Info (Bottom) - Black */}
          <div className="flex justify-between items-center mt-4 sm:mt-2 mx-[21px]">
            <PlayerInfo 
              position="bottom"
              username={player2.username}
              rating={player2.rating}
              clubAffiliation={player2.clubAffiliation}
              isGuest={player2.isGuest}
              capturedPieces={capturedByBlack || blackCapturedPieces}
            />
            {/* Bottom player timer (Black) */}
            <div>
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'black'}
                isDarkTheme={true}
                onTimeOut={() => handleTimeOut('black')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Player 2 Info (Top) - Black */}
          <div className="flex justify-between items-center mb-4 sm:mb-2 mx-[21px]">
            <PlayerInfo 
              position="top"
              username={player2.username}
              rating={player2.rating}
              clubAffiliation={player2.clubAffiliation}
              isGuest={player2.isGuest}
              capturedPieces={capturedByBlack || blackCapturedPieces}
            />
            {/* Top player timer (Black) */}
            <div>
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
            gameId={gameRoomId}
          />
          
          {/* Player 1 Info (Bottom) - White */}
          <div className="flex justify-between items-center mt-4 sm:mt-2 mx-[21px]">
            <PlayerInfo 
              position="bottom"
              username={player1.username}
              rating={player1.rating}
              clubAffiliation={player1.clubAffiliation}
              isGuest={player1.isGuest}
              capturedPieces={capturedByWhite || whiteCapturedPieces}
            />
            {/* Bottom player timer (White) */}
            <div>
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'white'}
                isDarkTheme={true}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
              />
            </div>
          </div>
        </>
      )}
      
      {/* Debug logging moved to useEffect */}
      
      {/* Move Controls */}
      <MoveControls
        onBack={handleBackClick}
        onForward={handleForwardClick}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        gameId={gameRoomId}
        gameState={gameState}
        onResign={handleResignGame}
        onAbortGame={handleAbortGame}
        moveHistory={moveHistory ? {
          length: moveHistory.moves.length,
          currentMoveIndex: moveHistory.currentMoveIndex
        } : undefined}
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