'use client';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import PlayerInfo from './PlayerInfo';
import MoveControls from './MoveControls';
import GameClock from './GameClock';
import GameResultScreen from './GameResultScreen';
import { MoveHistoryState } from '../utils/moveHistory';
import { getChessEngine, makeMove, resetChessEngine, setChessPosition, getGameStatus, getCurrentBoardState, isThreefoldRepetition, getFen, clearChessState } from '../utils/chessEngine';
import { useSound } from '../../context/SoundContext';
import { useSocket } from '../../context/SocketContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';
import { CapturedPiece, GameResultType, GameEndReason, GameResult, PlayerData } from '../utils/types';
import DisconnectionNotification from './DisconnectionNotification';
import { fetchGamePlayers } from '../api/gameApi';
import { Chess } from 'chess.js';
import { onBetResult, offBetResult } from '@/services/betService';
import { saveBetResult } from '@/services/betResultService';
import { useBet } from '../../context/BetContext';
import { useAuth } from '../../context/AuthContext';
import { BetResult } from '@/types/bet';

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
  
  // Router for navigation
  const router = useRouter();
  
  // Socket context for real-time communication
  const { socket } = useSocket();
  
  // Sound context
  const { soundEnabled } = useSound();
  
  // Add a ref to track the current sound state - MOVED UP to avoid reference errors
  const soundEnabledRef = useRef(soundEnabled);
  
  // Update the ref when sound state changes
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState | null>(null);
  const [sanMoveList, setSanMoveList] = useState<string[]>([]);
  
  // Captured pieces state
  const [capturedByWhite, setCapturedByWhite] = useState<CapturedPiece[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<CapturedPiece[]>([]);
  
  // Active player for timers
  const [activePlayer, setActivePlayer] = useState<'white' | 'black' | null>('white');
  
  // Player data state
  const [whitePlayer, setWhitePlayer] = useState<PlayerData>({
    username: "Loading...",
    rating: 0,
    capturedPieces: [],
    isGuest: false,
    photoURL: null,
    userId: undefined
  });
  
  const [blackPlayer, setBlackPlayer] = useState<PlayerData>({
    username: "Loading...",
    rating: 0,
    capturedPieces: [],
    isGuest: false,
    photoURL: null,
    userId: undefined
  });
  
  // Debug player data changes
  useEffect(() => {
    // Remove noisy log
    // console.log('White player data updated:', whitePlayer);
  }, [whitePlayer]);
  useEffect(() => {
    // Remove noisy log
    // console.log('Black player data updated:', blackPlayer);
  }, [blackPlayer]);
  
  // Loading state for player data
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(true);
  const [playerDataError, setPlayerDataError] = useState<string | null>(null);
  
  // Game state
  const [gameState, setGameState] = useState({
    hasStarted: true,
    isWhiteTurn: true,
    hasWhiteMoved: false,
    isGameOver: false,
    gameOverReason: null as string | null, // Add gameOverReason property
    timeControl: timeControl || '5+0', // Use passed timeControl or default
    gameMode: getGameModeFromTimeControl(timeControl || '5+0') // Derive game mode from time control
  });
  
  // Add debugging log when component first renders
  useEffect(() => {
    // Remove noisy log
    // console.log('ChessBoardWrapper initial gameState with hasWhiteMoved=false:', gameState);
  }, []);
  
  // Fetch real player data for the game
  useEffect(() => {
    if (!gameRoomId) {
      // Remove noisy log
      // console.log('No gameRoomId provided, skipping player data fetch');
      return;
    }
    
    // Function to fetch player data with retries
    const fetchPlayersWithRetries = async (retries = 3, delay = 2000) => {
      let lastError = null;
      
      // Set initial loading state
      setLoadingPlayers(true);
      setPlayerDataError(null);
      
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          // Only keep warning for invalid/incomplete data
          // console.log(`Fetching player data for game ID: ${gameRoomId} (Attempt ${attempt + 1}/${retries})`);
          const data = await fetchGamePlayers(gameRoomId);
          
          // Validate that we have real player data
          if (!data || !data.whitePlayer || !data.blackPlayer) {
            console.warn('Invalid player data format received:', data);
            throw new Error('Invalid player data format received');
          }
          
          const hasValidWhitePlayer = data.whitePlayer.username && data.whitePlayer.username !== 'Loading...';
          const hasValidBlackPlayer = data.blackPlayer.username && data.blackPlayer.username !== 'Loading...';
          
          if (!hasValidWhitePlayer || !hasValidBlackPlayer) {
            console.warn('Incomplete player data received, retrying...', { 
              whiteUsername: data.whitePlayer.username, 
              blackUsername: data.blackPlayer.username 
            });
            throw new Error('Incomplete player data received');
          }
          
          // Only keep log for successful fetch if needed for debugging
          // console.log('Player data fetched successfully:', {
          //   white: `${data.whitePlayer.username} (${data.whitePlayer.rating})`,
          //   black: `${data.blackPlayer.username} (${data.blackPlayer.rating})`
          // });
          
          // Update player states with real data
          setWhitePlayer({
            username: data.whitePlayer.username,
            rating: typeof data.whitePlayer.rating === 'number' ? data.whitePlayer.rating : 1500,
            capturedPieces: capturedByWhite,
            isGuest: false,
            photoURL: data.whitePlayer.photoURL,
            userId: data.whitePlayer.userId // Always set userId from API
          });
          
          setBlackPlayer({
            username: data.blackPlayer.username,
            rating: typeof data.blackPlayer.rating === 'number' ? data.blackPlayer.rating : 1500,
            capturedPieces: capturedByBlack,
            isGuest: false,
            photoURL: data.blackPlayer.photoURL,
            userId: data.blackPlayer.userId // Always set userId from API
          });
          
          setLoadingPlayers(false);
          return; // Success, exit the retry loop
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || 'Unknown error';
          console.error(`Error fetching player data (Attempt ${attempt + 1}/${retries}): ${errorMessage}`, error);
          
          // If we have more retries, wait before trying again
          if (attempt < retries - 1) {
            console.log(`Waiting ${delay}ms before retry ${attempt + 2}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all retries failed
      console.error(`All ${retries} attempts to fetch player data failed. Last error:`, lastError);
      setPlayerDataError(`Failed to load player data after ${retries} attempts`);
      setLoadingPlayers(false);
      
      // Set generic placeholder data as a last resort
      console.log('Setting placeholder player data after all retries failed');
      
      setWhitePlayer({
        username: 'White Player',
        rating: 1500,
        capturedPieces: capturedByWhite,
        isGuest: false,
        photoURL: null,
        userId: undefined
      });
      
      setBlackPlayer({
        username: 'Black Player',
        rating: 1500,
        capturedPieces: capturedByBlack,
        isGuest: false,
        photoURL: null,
        userId: undefined
      });
    };
    
    // Start the fetch process with retries
    fetchPlayersWithRetries();
    
    // Set up a periodic refresh to ensure player data stays up-to-date
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of player data');
      fetchPlayersWithRetries(2, 1000); // Fewer retries for periodic refresh
    }, 30000); // Refresh every 30 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(refreshInterval);
  }, [gameRoomId, capturedByWhite, capturedByBlack]);
  
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
  // Initialize empty captured pieces arrays
  useEffect(() => {
    // Initialize with empty arrays instead of mock data
    setCapturedByWhite([]);
    setCapturedByBlack([]);
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
      if (soundEnabledRef.current) {
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
      if (soundEnabledRef.current) {
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
      if (soundEnabledRef.current) {
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
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
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
      
      if (soundEnabledRef.current) {
        playSound('CHECKMATE', true);
      }
    });
    
    safeSocket.on('draw', () => {
      // Update game tracker state
      gameStateTracker.activePlayer = null;
      
      if (soundEnabledRef.current) {
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
      const isWhitePlayer = playerColor === 'white';
      const disconnectedPlayer = isWhitePlayer ? blackPlayer : whitePlayer;
      
      setDisconnectedPlayerName(disconnectedPlayer.username);
      setOpponentDisconnected(true);
      
      // Set the reconnection time limit (either 2 minutes or remaining time on clock, whichever is less)
      const timeLimit = Math.min(reconnectTimeoutSeconds, 120);
      setReconnectionTimeRemaining(timeLimit);
      
      // Play disconnection sound if enabled
      if (soundEnabledRef.current) {
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
      if (soundEnabledRef.current) {
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
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerRatingChange: isWinner ? 10 : -10,
        opponentRatingChange: isWinner ? -10 : 10
      };
      
      // Set result data and show result screen
      setGameResultData(resultData);
      setShowResultScreen(true);
      
      // Stop both clocks
      setActivePlayer(null);
      
      // Play game end sound
      if (soundEnabledRef.current) {
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
        if (soundEnabledRef.current) {
          playSound('NOTIFICATION', true);
        }
        
        // First, check if we already have real player data
        const hasRealWhiteData = whitePlayer.username !== 'Loading...';
        const hasRealBlackData = blackPlayer.username !== 'Loading...';
        
        console.log('Current player data before abort handling:', {
          hasRealWhiteData,
          hasRealBlackData,
          whitePlayer,
          blackPlayer
        });
        
        // If we don't have real player data yet, try to fetch it first
        if (!hasRealWhiteData || !hasRealBlackData) {
          console.log('Missing real player data, attempting to fetch before showing abort screen');
          
          // Try to fetch player data directly
          fetchGamePlayers(gameRoomId)
            .then(data => {
              console.log('Successfully fetched player data for abort:', data);
              
              // Create updated player data with real values from API
              const updatedWhitePlayer = {
                username: data?.whitePlayer?.username || 'White Player',
                rating: typeof data?.whitePlayer?.rating === 'number' ? data.whitePlayer.rating : 1500,
                capturedPieces: capturedByWhite,
                isGuest: false,
                photoURL: data?.whitePlayer?.photoURL || null,
                userId: data?.whitePlayer?.userId ?? undefined
              };
              
              const updatedBlackPlayer = {
                username: data?.blackPlayer?.username || 'Black Player',
                rating: typeof data?.blackPlayer?.rating === 'number' ? data.blackPlayer.rating : 1500,
                capturedPieces: capturedByBlack,
                isGuest: false,
                photoURL: data?.blackPlayer?.photoURL || null,
                userId: data?.blackPlayer?.userId ?? undefined
              };
              
              // Update player states with real data
              setWhitePlayer(updatedWhitePlayer);
              setBlackPlayer(updatedBlackPlayer);
              
              // Create game result data with the real player data we just fetched
              const abortResultData = {
                result: 'draw' as GameResultType,
                reason: 'abort' as GameEndReason,
                playerName: playerColor === 'white' ? updatedWhitePlayer.username : updatedBlackPlayer.username,
                opponentName: playerColor === 'white' ? updatedBlackPlayer.username : updatedWhitePlayer.username,
                playerRating: playerColor === 'white' ? updatedWhitePlayer.rating : updatedBlackPlayer.rating,
                opponentRating: playerColor === 'white' ? updatedBlackPlayer.rating : updatedWhitePlayer.rating,
                playerPhotoURL: playerColor === 'white' ? updatedWhitePlayer.photoURL : updatedBlackPlayer.photoURL,
                opponentPhotoURL: playerColor === 'white' ? updatedBlackPlayer.photoURL : updatedWhitePlayer.photoURL,
                playerRatingChange: 0, // No rating change on abort
                opponentRatingChange: 0  // No rating change on abort
              };
              
              console.log('Created game result data for abort with real player data:', abortResultData);
              
              // Set the game result data and show the result screen
              setGameResultData(abortResultData);
              setShowResultScreen(true);
            })
            .catch(error => {
              console.error('Failed to fetch player data for abort:', error);
              
              // Use fallback values if fetch fails
              const fallbackWhitePlayer: PlayerData = {
                username: 'White Player',
                rating: 1500,
                capturedPieces: capturedByWhite,
                isGuest: false,
                photoURL: null,
                userId: undefined
              };
              
              const fallbackBlackPlayer: PlayerData = {
                username: 'Black Player',
                rating: 1500,
                capturedPieces: capturedByBlack,
                isGuest: false,
                photoURL: null,
                userId: undefined
              };
              
              // Update player states with fallback data
              setWhitePlayer(fallbackWhitePlayer);
              setBlackPlayer(fallbackBlackPlayer);
              
              // Create game result data with fallback values
              const abortResultData = {
                result: 'draw' as GameResultType,
                reason: 'abort' as GameEndReason,
                playerName: playerColor === 'white' ? fallbackWhitePlayer.username : fallbackBlackPlayer.username,
                opponentName: playerColor === 'white' ? fallbackBlackPlayer.username : fallbackWhitePlayer.username,
                playerRating: playerColor === 'white' ? fallbackWhitePlayer.rating : fallbackBlackPlayer.rating,
                opponentRating: playerColor === 'white' ? fallbackBlackPlayer.rating : fallbackWhitePlayer.rating,
                playerPhotoURL: playerColor === 'white' ? fallbackWhitePlayer.photoURL : fallbackBlackPlayer.photoURL,
                opponentPhotoURL: playerColor === 'white' ? fallbackBlackPlayer.photoURL : fallbackWhitePlayer.photoURL,
                playerRatingChange: 0, // No rating change on abort
                opponentRatingChange: 0  // No rating change on abort
              };
              
              console.log('Created game result data for abort with fallback values:', abortResultData);
              
              // Set the game result data and show the result screen
              setGameResultData(abortResultData);
              setShowResultScreen(true);
            });
        } else {
          // We already have real player data, use it directly
          console.log('Using existing real player data for abort');
          
          // Create game result data with existing player data
          const abortResultData = {
            result: 'draw' as GameResultType,
            reason: 'abort' as GameEndReason,
            playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
            opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
            playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
            opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
            playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
            opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
            playerRatingChange: 0, // No rating change on abort
            opponentRatingChange: 0  // No rating change on abort
          };
          
          console.log('Created game result data for abort with existing player data:', abortResultData);
          
          // Set the game result data and show the result screen
          setGameResultData(abortResultData);
          setShowResultScreen(true);
        }

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
        if (soundEnabledRef.current) {
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
        const myName = playerColor === 'white' ? whitePlayer.username : blackPlayer.username;
        const opponentName = playerColor === 'white' ? blackPlayer.username : whitePlayer.username;

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

        // Log player data before creating result data for resignation
        console.log('Player data for game result (resignation):', {
          playerColor,
          whitePlayer,
          blackPlayer,
          myName,
          opponentName
        });

        // Set game result data for resignation
        const resignationResultData = {
          result: resultType,
          reason: 'resignation' as GameEndReason,
          playerName: myName,
          opponentName: opponentName,
          playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
          opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
          opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
          playerRatingChange: resultType === 'win' ? 10 : -10, 
          opponentRatingChange: resultType === 'win' ? -10 : 10
        };

        // Log the created result data
        console.log('Created game result data (resignation):', resignationResultData);
        
        setGameResultData(resignationResultData);

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

      // Handle threefold repetition game end
      if (data.reason === 'threefold_repetition') {
        console.log('Game ended due to threefold repetition - showing result screen');
        
        // Ensure player data is ready before creating game result data
        ensurePlayerDataReady();
        
        // Create game result data for threefold repetition
        const drawResultData = {
          result: 'draw' as GameResultType,
          reason: 'threefold_repetition' as GameEndReason,
          playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
          opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
          playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
          opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
          opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
          // Use rating changes from server data if available
          playerRatingChange: playerColor === 'white' ? (data.whitePlayer?.ratingChange || 0) : (data.blackPlayer?.ratingChange || 0),
          opponentRatingChange: playerColor === 'white' ? (data.blackPlayer?.ratingChange || 0) : (data.whitePlayer?.ratingChange || 0)
        };
        
        // Store the result data in localStorage for the result page
        try {
          localStorage.setItem(`gameResult_${gameRoomId}`, JSON.stringify(drawResultData));
          console.log('Game result data saved to localStorage for result page');
        } catch (error) {
          console.error('Failed to save game result data to localStorage:', error);
        }
        
        // Set game result data
        setGameResultData(drawResultData);
        
        // Update game state
        setGameState(prevState => ({
          ...prevState,
          isGameOver: true
        }));
        
        // Stop the clocks
        setActivePlayer(null);
        
        // Show result screen
        setShowResultScreen(true);
        console.log('Result screen activated for threefold repetition');
        
        // Play game end sound
        playSound('GAME_END', soundEnabled);
        
        // Navigate to the result page
        console.log(`Navigating to result page for game ${gameRoomId}`);
        setTimeout(() => {
          router.push(`/play/game/${gameRoomId}/result`);
        }, 1000); // Short delay to ensure the server has time to process the event
        
        return;
      }
      
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
          playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
          opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
          playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
          opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
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
          playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
          opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
          playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
          opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerRatingChange: resultType === 'win' ? 10 : (resultType === 'loss' ? -10 : 0),
          opponentRatingChange: resultType === 'win' ? -10 : (resultType === 'loss' ? 10 : 0)
        };
        
        // Set game result data
        setGameResultData(resultData);
        
        // Update game state and UI
        setGameState(prevState => ({
          ...prevState,
          isGameOver: true
        }));
        
        // Ensure player data is ready before creating game result data
        ensurePlayerDataReady();
        setActivePlayer(null);
        
        // Show result screen
        setShowResultScreen(true);
        console.log('Result screen activated for game_end event');
      }
    });

    // Threefold repetition handling is now integrated into the main game_end handler above

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
  }, [socket, gameRoomId, playSound]);

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
  
  // Function to synchronize the board state from move history (primary source of truth)
  const synchronizeBoardFromMoveHistory = useCallback((moveHistory: string[]) => {
    try {
      console.log(`Synchronizing board state from move history (${moveHistory.length} moves)`);
      
      // Reset the chess engine to the initial position
      const chess = resetChessEngine();
      
      // Apply each move in the history
      let allMovesApplied = true;
      for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];
        try {
          // Apply the move using SAN notation
          const result = chess.move(move);
          if (!result) {
            console.error(`Failed to apply move ${i+1}: ${move}`);
            // Try to apply the move using more flexible parsing
            try {
              // Try with a more flexible approach - create a move object if the string looks like coordinates
              if (move.match(/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/)) {
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                const promotion = move.length > 4 ? move.substring(4, 5).toLowerCase() : undefined;
                
                console.log(`Trying alternative move format: from=${from}, to=${to}, promotion=${promotion}`);
                const altResult = chess.move({
                  from,
                  to,
                  promotion
                });
                
                if (!altResult) {
                  console.error(`Alternative move format also failed`);
                  allMovesApplied = false;
                  break;
                } else {
                  console.log(`Alternative move format succeeded`);
                  continue; // Move to the next move in the history
                }
              }
              
              allMovesApplied = false;
              break;
            } catch (altError) {
              console.error(`Error applying alternative move format: ${altError instanceof Error ? altError.message : 'Unknown error'}`);
              allMovesApplied = false;
              break;
            }
          }
        } catch (moveError) {
          console.error(`Error applying move ${i+1}: ${move}. Error: ${moveError instanceof Error ? moveError.message : 'Unknown error'}`);
          allMovesApplied = false;
          break;
        }
      }
      
      if (allMovesApplied) {
        // Get the current FEN after applying all moves
        const currentFen = chess.fen();
        console.log(`Successfully synchronized board state from move history. Final FEN: ${currentFen}`);
        
        // Log the FEN parts for debugging
        const fenParts = currentFen.split(' ');
        console.log(`FEN parts: position=${fenParts.slice(0, 4).join(' ')}, halfmove=${fenParts[4]}, fullmove=${fenParts[5]}`);
        
        // Update the SAN move list
        setSanMoveList(moveHistory);
        
        // Notify parent about SAN move list changes if callback exists
        if (onSanMoveListChange) {
          onSanMoveListChange(moveHistory);
        }
        
        // Check for threefold repetition after synchronizing
        if (chess.isThreefoldRepetition()) {
          console.log('Threefold repetition detected after synchronizing board state');
          
          // If the game isn't already over and we have a socket connection
          if (!gameState.isGameOver && socket && socket.connected) {
            console.log('Emitting threefold_repetition event to server');
            
            // Emit game_end event to the server with threefold_repetition reason
            socket.emit('game_end', {
              gameId: gameRoomId,
              reason: 'threefold_repetition',
              fen: chess.fen(),
              moveHistory: chess.history() // Include move history for verification
            });
            
            // Update game state to mark game as over
            setGameState(prev => ({
              ...prev,
              isGameOver: true,
              gameOverReason: 'threefold_repetition'
            }));
            
            // Stop the clocks
            setActivePlayer(null);
          }
        }
        
        return true;
      } else {
        console.error('Failed to synchronize board state from move history');
        return false;
      }
    } catch (error) {
      console.error(`Error synchronizing board state from move history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [onSanMoveListChange, gameState.isGameOver, socket, gameRoomId, setGameState, setActivePlayer]);
  
  // Legacy function to rebuild the board state from move history
  const rebuildBoardFromMoveHistory = useCallback((moveHistory: string[]) => {
    return synchronizeBoardFromMoveHistory(moveHistory);
  }, [synchronizeBoardFromMoveHistory]);
  
  // Dedicated effect for handling the move queue
  // This is completely separated from sound settings or other game state updates
  useEffect(() => {
    if (!socket || !moveQueue.length || !gameRoomId) return;

    const move = moveQueue[0];
    const currentSocket = socket; // Capture current socket to avoid closure issues

    // Only send the move to the server, do not apply it locally
    const sendMoveToServer = () => {
      try {
        console.log(`Sending move to server: ${move.from} to ${move.to} (Socket connected: ${currentSocket.connected})`);
        const currentPlayerColor = !gameState.isWhiteTurn ? 'white' : 'black'; // Invert since move is being made

        // Get the current chess engine instance
        const chess = getChessEngine();
        const currentFen = chess.fen();
        const moveHistory = sanMoveList;

        // Emit the move_made event with SAN notation as the primary identifier
        currentSocket.emit('move_made', {
          gameId: gameRoomId,
          from: move.from,
          to: move.to,
          player: currentPlayerColor,
          promotion: move.promotion,
          currentFen: currentFen, // FEN before the move (for validation)
          moveHistory: moveHistory // Include move history for verification
        });
        console.log(`Move emitted to server: ${move.from}-${move.to}`);
      } catch (error) {
        console.error('Error sending move to server:', error);
      }
    };

    // Send the move to the server
    sendMoveToServer();
    // Remove the move from the queue immediately (or optionally, after server confirmation)
    setMoveQueue(prev => prev.slice(1));
  }, [socket, moveQueue, gameRoomId, gameState.isWhiteTurn, sanMoveList]);
  
  // Add a function to synchronize the board from FEN or move history
  const synchronizeBoardFromFen = useCallback((fen: string, moveHistory?: string[]) => {
    try {
      // If we have move history, prioritize it over FEN
      if (moveHistory && moveHistory.length > 0) {
        console.log(`Prioritizing move history (${moveHistory.length} moves) over FEN for synchronization`);
        const result = synchronizeBoardFromMoveHistory(moveHistory);
        
        if (result) {
          // If synchronization from move history was successful, validate against the FEN
          const chess = getChessEngine();
          const currentFen = chess.fen();
          
          // Compare only the position part (first 4 parts) of the FEN
          const providedFenParts = fen.split(' ');
          const currentFenParts = currentFen.split(' ');
          
          const providedPosition = providedFenParts.slice(0, 4).join(' ');
          const currentPosition = currentFenParts.slice(0, 4).join(' ');
          
          if (providedPosition !== currentPosition) {
            console.warn(`Position mismatch after synchronizing from move history. Server: ${providedPosition}, Local: ${currentPosition}`);
            console.warn('Continuing with move history-based position as it is the primary source of truth');
          } else {
            console.log('Position matches after synchronizing from move history');
          }
          
          return true;
        }
        
        // If synchronization from move history failed, fall back to FEN
        console.warn('Failed to synchronize from move history, falling back to FEN');
      }
      
      console.log(`Attempting to synchronize board with FEN: ${fen}`);
      const chess = getChessEngine();
      
      // Try to load the FEN into the chess engine
      try {
        // Attempt to load the FEN and check if it was successful
        chess.load(fen);
        
        // If we get here without an error, the FEN was loaded successfully
        // Verify the loaded FEN matches what we expected
        const loadedFen = chess.fen();
        
        // Check if the FEN was loaded correctly
        // We only compare the position part (first 4 parts of the FEN string)
        // because the halfmove clock and fullmove number might be different
        const fenParts = fen.split(' ');
        const loadedFenParts = loadedFen.split(' ');
        
        const fenPosition = fenParts.slice(0, 4).join(' ');
        const loadedFenPosition = loadedFenParts.slice(0, 4).join(' ');
        
        if (fenPosition !== loadedFenPosition) {
          console.error(`FEN position mismatch. Expected: ${fenPosition}, Got: ${loadedFenPosition}`);
          
          // Request a board sync from the server
          if (socket && gameRoomId) {
            console.log('Requesting board sync from server due to FEN position mismatch');
            socket.emit('request_board_sync', {
              gameId: gameRoomId,
              reason: 'fen_position_mismatch',
              clientState: chess.fen()
            });
          }
          return false;
        }
        
        // FEN was loaded successfully, but check if the move counts are incorrect
        // This is a common issue causing the FEN errors
        const halfMoveClock = parseInt(fenParts[4]);
        const fullMoveNumber = parseInt(fenParts[5]);
        const loadedHalfMoveClock = parseInt(loadedFenParts[4]);
        const loadedFullMoveNumber = parseInt(loadedFenParts[5]);
        
        if (halfMoveClock !== loadedHalfMoveClock || fullMoveNumber !== loadedFullMoveNumber) {
          console.warn(`Move count mismatch in FEN. Expected: ${halfMoveClock}/${fullMoveNumber}, Got: ${loadedHalfMoveClock}/${loadedFullMoveNumber}`);
          // We can continue since the position is correct, just log the issue
        }
        
        // Check for threefold repetition after loading FEN
        if (chess.isThreefoldRepetition()) {
          console.log('Threefold repetition detected after loading FEN');
          
          // If the game isn't already over and we have a socket connection
          if (!gameState.isGameOver && socket && socket.connected) {
            console.log('Emitting threefold_repetition event to server');
            
            // Emit game_end event to the server with threefold_repetition reason
            socket.emit('game_end', {
              gameId: gameRoomId,
              reason: 'threefold_repetition',
              fen: chess.fen(),
              moveHistory: chess.history() // Include move history for verification
            });
            
            // Update game state to mark game as over
            setGameState(prev => ({
              ...prev,
              isGameOver: true,
              gameOverReason: 'threefold_repetition'
            }));
            
            // Stop the clocks
            setActivePlayer(null);
          }
        }
      } catch (loadError) {
        console.error(`Error loading FEN: ${fen}. Error: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
        
        // Request a board sync from the server
        if (socket && gameRoomId) {
          console.log('Requesting board sync from server due to FEN load error');
          socket.emit('request_board_sync', {
            gameId: gameRoomId,
            reason: 'fen_load_error',
            clientState: chess.fen()
          });
        }
        return false;
      }
      
      console.log(`Successfully synchronized board with FEN: ${fen}`);
      return true;
    } catch (error) {
      console.error(`Error synchronizing board from FEN: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [socket, gameRoomId, synchronizeBoardFromMoveHistory, gameState.isGameOver, setGameState, setActivePlayer]);
  
  // Function to synchronize the board state from move history (primary source of truth)
    // These functions were previously duplicated and have been removed to fix TypeScript errors

  
  // Listen for board_updated events from the server (primary source of truth)
  useEffect(() => {
    if (!socket) return;
    
    // Create a gameStateTracker for this specific handler
    const gameStateTracker = {
      isWhiteTurn: true,
      activePlayer: 'white' as 'white' | 'black' | null,
      lastUpdateTime: Date.now(),
      hasStarted: false
    };

    const handleBoardUpdated = (data: { 
      gameId: string, 
      moveHistory: string[], // Primary source of truth
      verboseMoveHistory?: any[], 
      lastMove?: string,
      fen?: string, // For validation only
      pgn?: string,
      whiteTurn?: boolean,
      isCapture?: boolean,
      isCheck?: boolean,
      moveCount?: number,
      isGameOver?: boolean,
      gameOverReason?: string,
      timestamp: number 
    }) => {
      if (data.gameId !== gameRoomId) return;
      
      // Check if the game is already over
      if (gameState.isGameOver) {
        console.log('Game is already over, ignoring board_updated event');
        return;
      }
      
      console.log(`Received board_updated event for game ${data.gameId} with ${data.moveHistory.length} moves`);
      
      // Log the last move if available
      if (data.lastMove) {
        console.log(`Last move: ${data.lastMove}, isCapture: ${data.isCapture}, isCheck: ${data.isCheck}`);
      }
      
      // Compare current move history with received move history
      const moveHistoryChanged = JSON.stringify(sanMoveList) !== JSON.stringify(data.moveHistory);
      if (!moveHistoryChanged && sanMoveList.length > 0) {
        console.log('Move history unchanged, skipping full board synchronization');
        
        // Still update turn information if provided
        if (data.whiteTurn !== undefined) {
          setActivePlayer(data.whiteTurn ? 'white' : 'black');
          
          // Also update game state
          setGameState(prev => ({
            ...prev,
            isWhiteTurn: data.whiteTurn === true, // Ensure boolean type
            hasWhiteMoved: data.moveHistory.length > 0
          }));
        }
        
        return;
      }
      
      // Synchronize the board using move history as the primary source of truth
      // Always trust the server's move history and FEN
      const syncResult = synchronizeBoardFromMoveHistory(data.moveHistory);
      if (syncResult) {
        setBoardState(getCurrentBoardState());
        // If FEN is provided, validate it against our local state
        if (data.fen) {
          const chess = getChessEngine();
          const localFen = chess.fen();
          const serverFenParts = data.fen.split(' ');
          const localFenParts = localFen.split(' ');
          const serverPosition = serverFenParts.slice(0, 4).join(' ');
          const localPosition = localFenParts.slice(0, 4).join(' ');
          if (serverPosition !== localPosition) {
            // FEN mismatch: force sync and request board sync from server
            setChessPosition(data.fen, gameRoomId);
            setSanMoveList(data.moveHistory);
            if (onSanMoveListChange) onSanMoveListChange(data.moveHistory);
            if (socket && gameRoomId) {
              socket.emit('request_board_sync', {
                gameId: gameRoomId,
                reason: 'fen_sync_failed',
                clientState: localFen
              });
            }
          } else {
            // FEN matches, update move list
            setSanMoveList(data.moveHistory);
            if (onSanMoveListChange) onSanMoveListChange(data.moveHistory);
          }
        }
        // Update active player and game state
        if (data.whiteTurn !== undefined) {
          setActivePlayer(data.whiteTurn ? 'white' : 'black');
          setGameState(prev => ({
            ...prev,
            isWhiteTurn: data.whiteTurn === true,
            hasWhiteMoved: data.moveHistory.length > 0
          }));
        }
      } else {
        // If move history sync fails, fallback to FEN
        if (data.fen) {
          synchronizeBoardFromFen(data.fen, data.moveHistory);
          if (socket && gameRoomId) {
            socket.emit('request_board_sync', {
              gameId: gameRoomId,
              reason: 'critical_sync_failure',
              clientState: getChessEngine().fen()
            });
          }
        }
      }
    };
    
    // Register the board_updated event handler
    socket.on('board_updated', handleBoardUpdated);
    
    // For backward compatibility, also keep the board_sync handler
    const handleBoardSync = (data: { 
      gameId: string, 
      fen: string, 
      moveHistory?: string[], 
      verboseMoveHistory?: any[], 
      pgn?: string,
      whiteTurn?: boolean,
      timestamp: number 
    }) => {
      if (data.gameId !== gameRoomId) return;
      
      console.log(`Received board_sync event for game ${data.gameId} with FEN: ${data.fen}`);
      
      // If move history is available, use it as the primary source of truth
      if (data.moveHistory && data.moveHistory.length > 0) {
        console.log(`Using move history from board_sync event (${data.moveHistory.length} moves)`);
        synchronizeBoardFromMoveHistory(data.moveHistory);
        setBoardState(getCurrentBoardState());
      } else {
        // Fall back to FEN synchronization
        console.log(`No move history in board_sync event, falling back to FEN`);
        synchronizeBoardFromFen(data.fen);
        setBoardState(getCurrentBoardState());
      }
      
      // Update active player based on whiteTurn if provided
      if (data.whiteTurn !== undefined) {
        setActivePlayer(data.whiteTurn ? 'white' : 'black');
        
        // Also update game state
        setGameState(prev => ({
          ...prev,
          isWhiteTurn: data.whiteTurn === true, // Ensure boolean type
          hasWhiteMoved: data.moveHistory !== undefined && data.moveHistory.length > 0
        }));
      }
    };
    
    socket.on('board_sync', handleBoardSync);
    
    // Handle game_end event from server
    const handleGameEnd = (data: any) => {
      console.log('Received game_end event:', data);
      
      // Check if this update is for our current game
      if (data.gameId !== gameRoomId) {
        console.log(`Ignoring game_end for different game (${data.gameId} vs ${gameRoomId})`);
        return;
      }
      
      // Check if the game is already marked as over
      if (gameState.isGameOver) {
        console.log('Game is already marked as over, updating result details');
      } else {
        console.log('Marking game as over and stopping clocks');
        // Update game state to reflect game over
        setGameState(prev => ({
          ...prev,
          isGameOver: true,
          gameOverReason: data.reason
        }));
        
        // Stop the clocks
        setActivePlayer(null);
      }
      
      // Determine the result from the player's perspective
      let playerResult: GameResultType = 'draw';
      if (data.result === 'draw' || data.reason === 'threefold_repetition') {
        playerResult = 'draw';
      } else if (data.winner) {
        // If there's a winner, determine if it's the player
        const isPlayerWinner = 
          (playerColor === 'white' && data.winner === 'white') ||
          (playerColor === 'black' && data.winner === 'black');
        playerResult = isPlayerWinner ? 'win' : 'loss';
      }
      
      // Set the game result for display
      const resultData = {
        result: playerResult,
        reason: data.reason as GameEndReason,
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
        playerRatingChange: data.whitePlayer?.ratingChange !== undefined ? 
          (playerColor === 'white' ? data.whitePlayer.ratingChange : data.blackPlayer.ratingChange) : 0,
        opponentRatingChange: data.whitePlayer?.ratingChange !== undefined ? 
          (playerColor === 'white' ? data.blackPlayer.ratingChange : data.whitePlayer.ratingChange) : 0
      };
      
      // Create game result data for the window event
      const gameEndedEvent = new CustomEvent('game_ended', {
        detail: resultData
      });
      
      // Dispatch the event to trigger the game result screen
      window.dispatchEvent(gameEndedEvent);
      
      console.log('Dispatched game_ended event with result data:', resultData);
      
      console.log(`Game over: ${playerResult} by ${data.reason}. Showing result screen.`);
      
      // Play game end sound
      playSound('GAME_END', soundEnabled);
    };
    
    // Also listen for game_ended event (backward compatibility)
    const handleGameEnded = (data: any) => {
      console.log('Received game_ended event:', data);
      handleGameEnd(data); // Reuse the same handler
    };
    
    // Register the game end event handlers
    socket.on('game_end', handleGameEnd);
    socket.on('game_ended', handleGameEnded);
    
    return () => {
      socket.off('board_updated', handleBoardUpdated);
      socket.off('board_sync', handleBoardSync);
      socket.off('game_end', handleGameEnd);
      socket.off('game_ended', handleGameEnded);
    };
  }, [socket, gameRoomId, synchronizeBoardFromMoveHistory, synchronizeBoardFromFen, onSanMoveListChange, gameState.isGameOver, setGameState, setActivePlayer, playerColor, whitePlayer, blackPlayer, soundEnabled]);

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
    
    // Handle threefold repetition
    if (status.isThreefoldRepetition) {
      console.log('Threefold repetition detected - game is a draw');
      
      // Ensure player data is ready before creating game result data
      ensurePlayerDataReady();
      
      // Create game result data for threefold repetition
      const resultData = {
        result: 'draw' as GameResultType,
        reason: 'threefold_repetition' as GameEndReason,
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
        playerRatingChange: 0, // Draw means no rating change
        opponentRatingChange: 0  // Draw means no rating change
      };
      
      // Log the created result data
      console.log('Created game result data (threefold repetition):', resultData);
      
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
      
      // Play draw sound - only if sound is enabled
      if (soundEnabled) {
        playSound('GAME_END', true);
      }
      
      // Notify the server about the threefold repetition
      if (socket) {
        console.log('Emitting threefold_repetition event to server');
        socket.emit('threefold_repetition', {
          gameId: gameRoomId,
          fen: status.fen
        });
        
        // Also emit a game_ended event for consistency with other end conditions
        socket.emit('game_ended', {
          gameId: gameRoomId,
          reason: 'threefold_repetition',
          result: 'draw'
        });
      }
      
      // Dispatch a local game_ended event
      try {
        const gameEndedEvent = new CustomEvent('game_ended', {
          detail: {
            reason: 'threefold_repetition',
            result: 'draw',
            source: 'local_threefold_repetition',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(gameEndedEvent);
      } catch (error) {
        console.error('Error dispatching threefold_repetition event:', error);
      }
      
      return;
    }
    
    // Handle checkmate immediately
    if (status.isCheckmate) {
      // Ensure player data is ready before creating game result data
      ensurePlayerDataReady();
      
      // Determine the winner based on whose turn it is
      // In chess, the player who can't move is in checkmate, so the other player wins
      const isCurrentPlayerWinner = (status.turn === 'white' && playerColor === 'black') || 
                                  (status.turn === 'black' && playerColor === 'white');
      
      // Log player data before creating result data for checkmate
      console.log('Player data for game result (checkmate):', {
        playerColor,
        whitePlayer,
        blackPlayer,
        isCurrentPlayerWinner
      });

      // Create game result data for checkmate
      const resultData = {
        result: isCurrentPlayerWinner ? 'win' : 'loss' as 'win' | 'loss',
        reason: 'checkmate' as GameEndReason,
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
        playerRatingChange: isCurrentPlayerWinner ? 10 : -10,
        opponentRatingChange: isCurrentPlayerWinner ? -10 : 10
      };
      
      // Log the created result data
      console.log('Created game result data (checkmate):', resultData);
      
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
      if (soundEnabledRef.current) {
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
      // Ensure player data is ready before creating game result data
      ensurePlayerDataReady();
      
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
      
      // Get player and opponent based on color
      const player = playerColor === 'white' ? whitePlayer : blackPlayer;
      const opponent = playerColor === 'white' ? blackPlayer : whitePlayer;

      // Ensure we have valid player data, or use fallback values
      const playerName = player?.username || (playerColor === 'white' ? 'White Player' : 'Black Player');
      const opponentName = opponent?.username || (playerColor === 'white' ? 'Black Player' : 'White Player');
      const playerRating = typeof player?.rating === 'number' ? player.rating : 1500;
      const opponentRating = typeof opponent?.rating === 'number' ? opponent.rating : 1500;

      // Log player data before creating result data
      console.log('Player data for game result (stalemate/draw):', {
        playerColor,
        player,
        opponent,
        whitePlayer,
        blackPlayer
      });

      // Create result data with safe values
      const resultData = {
        result,
        reason,
        playerName,
        opponentName,
        playerRating,
        opponentRating,
        playerPhotoURL: player?.photoURL || null,
        opponentPhotoURL: opponent?.photoURL || null,
        playerRatingChange: result === 'win' ? 10 : (result === 'loss' ? -10 : 0),
        opponentRatingChange: result === 'win' ? -10 : (result === 'loss' ? 10 : 0)
      };
      
      // Log the created result data
      console.log('Created game result data (stalemate/draw):', resultData);
      
      console.log('Game result data created:', resultData);
      
      // Set result data and show the screen
      setGameResultData(resultData);
      setShowResultScreen(true);
    }
    
    // Update active player for clocks
    if (status.isGameOver) {
      setActivePlayer(null); // Stop both clocks
    } else {
      setActivePlayer(status.turn === 'white' ? 'white' : 'black'); // Set the active player based on whose turn it is
      
      // Check for threefold repetition after the move with enhanced validation
      try {
        // First ensure the chess engine is in a valid state
        const chess = getChessEngine();
        const currentFen = chess.fen();
        
        // Log the current position for debugging
        console.log(`Current position FEN: ${currentFen}`);
        console.log(`Move history length: ${chess.history().length}`);
        
        // Only check for threefold repetition if we have enough moves
        // Threefold repetition requires at least 8 moves (4 by each player)
        if (chess.history().length >= 8) {
          // Use the chess.js isThreefoldRepetition method to check
          const isThreefoldRep = isThreefoldRepetition();
          
          console.log(`Threefold repetition check result: ${isThreefoldRep}`);
          
          if (isThreefoldRep && !gameState.isGameOver && socket) {
            console.log('THREEFOLD REPETITION DETECTED! Emitting game_end event to server...');
            
            // Emit game_end event to the server with threefold_repetition reason
            // This follows the same pattern as other game-ending scenarios
            socket.emit('game_end', {
              gameId: gameRoomId,
              reason: 'threefold_repetition',
              fen: currentFen,
              moveHistory: chess.history() // Include move history for verification
            });
            
            // Update game state to mark game as over
            setGameState(prev => ({
              ...prev,
              isGameOver: true,
              gameOverReason: 'threefold_repetition'
            }));
            
            // Stop the clocks
            setActivePlayer(null);
            
            // Play game end sound
            playSound('GAME_END', soundEnabled);
            
            console.log('Waiting for server to process threefold repetition and emit game_end event...');
            
            // Request a board sync to ensure all clients have the correct state
            socket.emit('request_board_sync', {
              gameId: gameRoomId,
              reason: 'threefold_repetition_detected',
              clientState: currentFen
            });
            
            // Store a temporary game result in localStorage to ensure we can show the result screen
            // even if there's a delay in receiving the server's game_end event
            try {
              const tempResultData = {
                result: 'draw' as GameResultType,
                reason: 'threefold_repetition' as GameEndReason,
                playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
                opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
                playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
                opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
                playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
                opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
                playerRatingChange: 0, // Will be updated when server responds
                opponentRatingChange: 0 // Will be updated when server responds
              };
              
              localStorage.setItem(`gameResult_${gameRoomId}`, JSON.stringify(tempResultData));
              console.log('Temporary game result data saved to localStorage for threefold repetition');
            } catch (storageError) {
              console.error('Failed to save temporary game result data to localStorage:', storageError);
            }
          }
        }
      } catch (error) {
        console.error(`Error checking for threefold repetition: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // If there's an error, request a board sync to recover
        if (socket && gameRoomId) {
          console.log('Requesting board sync due to threefold repetition check error');
          socket.emit('request_board_sync', {
            gameId: gameRoomId,
            reason: 'threefold_repetition_check_error',
            clientState: getChessEngine().fen()
          });
        }
      }
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
  }, [soundEnabled, playerColor, whitePlayer.username, whitePlayer.rating, blackPlayer.username, blackPlayer.rating]);
  
  // Handle back button click
  const handleBackClick = useCallback(() => {
    // These buttons interact with the board through its exposed methods
    // We're simulating a click on the hidden button in ChessBoard
    const backButton = document.querySelector('.hidden button:first-child') as HTMLButtonElement;
    if (backButton) {
      backButton.click();
    }
    
    // Play button click sound with button label - use the ref value
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Back');
  }, [playSound]); // Remove soundEnabled from deps
  
  // Handle forward button click
  const handleForwardClick = useCallback(() => {
    // These buttons interact with the board through its exposed methods
    // We're simulating a click on the hidden button in ChessBoard
    const forwardButton = document.querySelector('.hidden button:last-child') as HTMLButtonElement;
    if (forwardButton) {
      forwardButton.click();
    }
    
    // Play button click sound with button label - use the ref value
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Forward');
  }, [playSound]); // Remove soundEnabled from deps
  
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
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
      playerRatingChange: player === playerColor ? -10 : 10,
      opponentRatingChange: player === playerColor ? 10 : -10
    };
    
    // Set result data and show result screen
    setGameResultData(timeoutResultData);
    setShowResultScreen(true);
    
    // Play time out sound
    if (soundEnabledRef.current) {
      playSound('GAME_END', true);
    }
    
    // Set game result data based on the player who timed out
    const resultType = playerColor === player ? 'loss' : 'win';
    setGameResultData({
      result: resultType as GameResultType,
      reason: 'timeout' as GameEndReason,
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
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
    
    // Play button click sound using ref
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Accept');
    
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
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
      playerRatingChange: 0,
      opponentRatingChange: 0
    };
    
    // Set result data and show result screen
    setGameResultData(drawResultData);
    setShowResultScreen(true);
    
    // Stop the clocks
    setActivePlayer(null);
  }, [socket, gameRoomId, drawOfferTimeout, playSound]); // Remove soundEnabled dependency

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    socket.emit('decline_draw', { gameId: gameRoomId });
    setDrawOfferReceived(false);
    
    // Play button click sound using ref
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Decline');
    
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
  }, [socket, gameRoomId, drawOfferTimeout, playSound]); // Remove soundEnabled dependency

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
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
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
    
    // Play sound using ref
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Abort');
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
  const [gameResultData, setGameResultData] = useState<GameResult>({
    result: 'draw',
    reason: 'stalemate',
    playerName: 'Player',
    opponentName: 'Opponent',
    playerRating: 1500,
    opponentRating: 1500,
    playerPhotoURL: null,
    opponentPhotoURL: null,
    playerRatingChange: 0,
    opponentRatingChange: 0
  });

  // Add handler to close game result screen
  const handleCloseResultScreen = useCallback(() => {
    setShowResultScreen(false);
    
    // Redirect to home or matchmaking page
    window.location.href = '/';
  }, []);

  // Helper function to ensure player data is ready before creating game result data
  const ensurePlayerDataReady = () => {
    console.log('Ensuring player data is ready for game result display');
    console.log('Current white player:', whitePlayer);
    console.log('Current black player:', blackPlayer);
    
    // If player data is still loading or incomplete, set fallback values
    if (whitePlayer.username === 'Loading...' || blackPlayer.username === 'Loading...' ||
        whitePlayer.photoURL === undefined || blackPlayer.photoURL === undefined) {
      console.log('Player data incomplete, setting fallback values');
      
      // Update white player with fallback values
      setWhitePlayer(prev => ({
        ...prev,
        username: prev.username === 'Loading...' ? 'White Player' : prev.username,
        rating: prev.rating || 1500,
        photoURL: prev.photoURL !== undefined ? prev.photoURL : null,
        userId: prev.userId !== undefined ? prev.userId : undefined
      }));
      
      // Update black player with fallback values
      setBlackPlayer(prev => ({
        ...prev,
        username: prev.username === 'Loading...' ? 'Black Player' : prev.username,
        rating: prev.rating || 1500,
        photoURL: prev.photoURL !== undefined ? prev.photoURL : null,
        userId: prev.userId !== undefined ? prev.userId : undefined
      }));
    }
  };

  // Listen for the game_ended custom event
  useEffect(() => {
    const handleGameEnded = (event: CustomEvent) => {
      // Ensure player data is ready before creating game result data
      ensurePlayerDataReady();
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
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
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
    
    // This useEffect should now only log the sound toggle without affecting chess state
  }, [soundEnabled, gameId]);

  // Socket reconnection and game abort event handler
  useEffect(() => {
    if (!socket || !gameRoomId) {
      return () => {};
    }
    
    // Create a safe reference to the socket for cleanup
    const safeSocket = socket;
    let reconnectionTimerId: ReturnType<typeof setInterval> | undefined;
    
    // Listen for game aborted events
    safeSocket.on('game_aborted', () => {
      console.log('Game was aborted by server or opponent');
      
      // Play sound, using ref value
      if (soundEnabledRef.current) {
        playSound('GAME_END', true);
      }
      
      // Implement local state updates for game aborted
      // ...
    });
    
    // Return cleanup function
    return () => {
      console.log('Cleaning up socket handlers');
      
      // Clean up event handlers
      safeSocket.off('game_aborted');
      
      // Clear any existing timeouts
      if (reconnectionTimerId) {
        clearInterval(reconnectionTimerId);
      }
    };
  }, [socket, gameRoomId, playSound]); // Properly reference only stable dependencies

  const handleBetResult = (data: BetResult) => {
    console.log('[ChessBoardWrapper] handleBetResult called with:', data);
    saveBetResult(data.gameId, data);
    console.log('[ChessBoardWrapper] saveBetResult called for gameId:', data.gameId);
  };

  const { currentBetResult } = useBet();
  const { user } = useAuth();

  useEffect(() => {
    console.log('[ChessBoardWrapper] currentBetResult changed:', currentBetResult);
  }, [currentBetResult]);

  // Determine if this is a bet game and if the user is the winner
  const isBetGame = !!(currentBetResult && currentBetResult.gameId === gameRoomId);
  const isBetResultForThisGame = currentBetResult && currentBetResult.gameId === gameRoomId;
  // Use isWinner directly from backend payload
  const isBetWinner = isBetGame ? currentBetResult.isWinner : false;
  // Use opponentName and betType directly from backend payload
  const betOpponentName = isBetGame ? currentBetResult.opponentName : undefined;
  const betType = isBetGame ? currentBetResult.betType : undefined;

  // Debug logs
  useEffect(() => {
    console.log('[ChessBoardWrapper] currentBetResult:', currentBetResult);
    console.log('[ChessBoardWrapper] isBetGame:', isBetGame, 'isBetResultForThisGame:', isBetResultForThisGame);
  }, [currentBetResult, isBetGame, isBetResultForThisGame]);

  // If the game is a bet game and the result is not yet available, show a loading spinner
  const shouldShowBetResultLoading =
    showResultScreen &&
    isBetGame &&
    !isBetResultForThisGame;

  if (showResultScreen && gameResultData && (!isBetGame || isBetResultForThisGame)) {
    console.log('[ChessBoardWrapper] Rendering result modal for bet game. isBetGame:', isBetGame, 'isBetResultForThisGame:', isBetResultForThisGame, 'currentBetResult:', currentBetResult);
  }

  // --- BET RESULT SCREEN IMPROVEMENT START ---
  // Local state to track when game is over and when bet result is ready
  const [isGameActuallyOver, setIsGameActuallyOver] = useState(false);
  const [localBetResultForThisGame, setLocalBetResultForThisGame] = useState<BetResult | null>(null);
  const [finalGameResultData, setFinalGameResultData] = useState<any>(null);
  const [betResultReady, setBetResultReady] = useState(false);
  const [displayableResultData, setDisplayableResultData] = useState<any>(null);

  // Track when the game is actually over (from game_ended event)
  useEffect(() => {
    const handleGameEnded = (event: CustomEvent) => {
      ensurePlayerDataReady();
      const { reason, result, winnerSocketId, loserSocketId, source, winnerColor, loserColor } = event.detail;
      console.log('[BET DEBUG] game_ended event received:', { reason, result, winnerSocketId, loserSocketId, source, mySocketId: socket?.id, winnerColor, loserColor });
      setIsGameActuallyOver(true);
      // Build standard game result data (for fallback)
      let finalResult: GameResultType;
      if (winnerColor && loserColor && playerColor) {
        if (playerColor === winnerColor) {
          finalResult = 'win';
        } else if (playerColor === loserColor) {
          finalResult = 'loss';
        } else {
          finalResult = 'draw';
        }
      } else if (result === 'win' || result === 'loss' || result === 'draw') {
        finalResult = result as GameResultType;
      } else if (socket && (winnerSocketId || loserSocketId)) {
        if (winnerSocketId && socket.id === winnerSocketId) {
          finalResult = 'win';
        } else if (loserSocketId && socket.id === loserSocketId) {
          finalResult = 'loss';
        } else if (reason === 'resignation') {
          finalResult = 'loss';
        } else {
          finalResult = 'draw';
        }
      } else {
        if (reason === 'resignation') {
          finalResult = 'loss';
        } else {
          finalResult = 'draw';
        }
      }
      const resultData = {
        result: finalResult,
        reason: reason as GameEndReason,
        playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
        opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
        playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
        opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL,
        playerRatingChange: finalResult === 'win' ? 10 : (finalResult === 'loss' ? -10 : 0),
        opponentRatingChange: finalResult === 'win' ? -10 : (finalResult === 'loss' ? 10 : 0)
      };
      setFinalGameResultData(resultData);
      // Don't show result screen here, wait for merged logic
    };
    window.addEventListener('game_ended', handleGameEnded as EventListener);
    return () => window.removeEventListener('game_ended', handleGameEnded as EventListener);
  }, [socket, playerColor, whitePlayer, blackPlayer]);

  // Track when bet result is available for this game
  useEffect(() => {
    if (currentBetResult && currentBetResult.gameId === gameRoomId) {
      setLocalBetResultForThisGame(currentBetResult);
      setBetResultReady(true);
      console.log('[BET DEBUG] Bet result received for this game:', currentBetResult);
    }
  }, [currentBetResult, gameRoomId]);

  // Main effect to control when to show the result screen (robust against race conditions)
  useEffect(() => {
    // Log all relevant state for debugging
    console.log('[BET DEBUG] useEffect triggered:', {
      isGameActuallyOver,
      betResultReady,
      localBetResultForThisGame,
      currentBetResult,
      finalGameResultData,
      gameRoomId,
      isBetGame
    });

    if (!isGameActuallyOver) {
      setDisplayableResultData(null);
      return;
    }

    // If this is a bet game (detected by localBetResultForThisGame for this game)
    const isThisBetGame = !!(localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId);

    if (isThisBetGame) {
      if (betResultReady && localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId) {
        // Merge bet result and standard game result
        const isWinnerOfBet = localBetResultForThisGame.isWinner;
        const betType = localBetResultForThisGame.betType;
        const betOpponentName = localBetResultForThisGame.opponentName;
        const opponentIdForBetContext = isWinnerOfBet ? localBetResultForThisGame.loserId : localBetResultForThisGame.winnerId;

        const betGameResultData = {
          ...(finalGameResultData || {}),
          result: isWinnerOfBet ? 'win' : 'loss',
          isBetGame: true,
          isBetWinner: isWinnerOfBet,
          betType,
          betOpponentName,
          opponentIdForBetContext,
          playerName: finalGameResultData?.playerName,
          opponentName: finalGameResultData?.opponentName,
          playerRating: Number.isFinite(finalGameResultData?.playerRating) ? finalGameResultData.playerRating : 1500,
          opponentRating: Number.isFinite(finalGameResultData?.opponentRating) ? finalGameResultData.opponentRating : 1500,
        };
        setDisplayableResultData(betGameResultData);
        console.log('[BET DEBUG] Showing BET result screen:', betGameResultData);
      } else {
        // Bet result not ready, show spinner
        setDisplayableResultData(null);
        console.log('[BET DEBUG] Waiting for bet result...');
      }
    } else {
      // Not a bet game, show standard result
      if (finalGameResultData) {
        setDisplayableResultData({
          ...finalGameResultData,
          isBetGame: false,
          playerRating: Number.isFinite(finalGameResultData?.playerRating) ? finalGameResultData.playerRating : 1500,
          opponentRating: Number.isFinite(finalGameResultData?.opponentRating) ? finalGameResultData.opponentRating : 1500,
        });
        console.log('[BET DEBUG] Showing STANDARD result screen:', finalGameResultData);
      } else {
        setDisplayableResultData(null);
      }
    }
  }, [
    isGameActuallyOver,
    betResultReady,
    localBetResultForThisGame,
    finalGameResultData,
    gameRoomId,
    isBetGame
  ]);

  // Always clear previous chess state and initialize engine when a new game starts
  useEffect(() => {
    if (!gameRoomId) return;
    clearChessState();
    const chess = getChessEngine(gameRoomId);
    console.log('Initialized chess engine for new game:', gameRoomId, 'FEN:', chess.fen());
    setBoardState(getCurrentBoardState());
    setSanMoveList(chess.history());
  }, [gameRoomId]);

  // Ensure boardState and setBoardState are defined
  const [boardState, setBoardState] = useState(getCurrentBoardState());

  return (
    <div className="flex flex-col w-full h-full rounded-t-xl rounded-b-none sm:rounded-t-xl sm:rounded-b-none overflow-hidden flex-shrink-0 pb-[62px]" style={{ backgroundColor: '#4A7C59' }}>
      {/* Bet Result Loading Spinner */}
      {isGameActuallyOver && isBetGame && !(localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId) && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-[#4A7C59] border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-[#F9F3DD] text-sm">Waiting for bet result...</p>
        </div>
      )}
      {/* Game Result Screen */}
      {displayableResultData && (
        (() => {
          console.log('[BET DEBUG] Rendering GameResultScreen with props:', displayableResultData);
          return (
            <GameResultScreen
              result={displayableResultData.result}
              reason={displayableResultData.reason}
              gameId={gameRoomId}
              playerName={displayableResultData.playerName}
              opponentName={displayableResultData.opponentName}
              playerRating={displayableResultData.playerRating}
              opponentRating={displayableResultData.opponentRating}
              playerRatingChange={displayableResultData.playerRatingChange}
              opponentRatingChange={displayableResultData.opponentRatingChange}
              playerPhotoURL={displayableResultData.playerPhotoURL}
              opponentPhotoURL={displayableResultData.opponentPhotoURL}
              onClose={handleCloseResultScreen}
              isBetGame={displayableResultData.isBetGame}
              isBetWinner={displayableResultData.isBetWinner}
              betOpponentName={displayableResultData.betOpponentName}
              betType={displayableResultData.betType}
              opponentIdForBetContext={displayableResultData.opponentIdForBetContext}
            />
          );
        })()
      )}
      
      {/* Draw Offer Notification */}
      {/* <DrawOfferNotification
        isOpen={drawOfferReceived}
        onAccept={handleAcceptDraw}
        onDecline={handleDeclineDraw}
        opponentName={playerColor === 'white' ? blackPlayer.username : whitePlayer.username}
        timeRemaining={drawOfferTimeRemaining}
      /> */}
      
      {/* Determine which player is at top/bottom based on perspective */}
      {playerColor === 'black' ? (
        <>
          {/* Player 1 Info (Top) - White */}
          <div className="flex justify-between items-center mb-4 sm:mb-2 mx-[21px]">
            <PlayerInfo 
              position="top"
              username={whitePlayer.username}
              rating={whitePlayer.rating}
              clubAffiliation={whitePlayer.clubAffiliation}
              isGuest={whitePlayer.isGuest || false}
              capturedPieces={capturedByWhite}
              photoURL={whitePlayer.photoURL}
              isActive={activePlayer === 'white'}
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
          username={blackPlayer.username}
          rating={blackPlayer.rating}
          clubAffiliation={blackPlayer.clubAffiliation}
          isGuest={blackPlayer.isGuest || false}
          capturedPieces={capturedByBlack}
          photoURL={blackPlayer.photoURL}
          isActive={activePlayer === 'black'}
        />
            {/* Bottom player timer (Black) */}
            <div>
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'black'}
                isDarkTheme={true}
                onTimeOut={() => handleTimeOut('black')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
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
              username={blackPlayer.username}
              rating={blackPlayer.rating}
              clubAffiliation={blackPlayer.clubAffiliation}
              isGuest={blackPlayer.isGuest || false}
              capturedPieces={capturedByBlack}
              photoURL={blackPlayer.photoURL}
              isActive={activePlayer === 'black'}
            />
            {/* Top player timer (Black) */}
            <div>
              <GameClock 
                timeInSeconds={gameTimeInSeconds}
                isActive={activePlayer === 'black'}
                isDarkTheme={false}
                onTimeOut={() => handleTimeOut('black')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
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
              username={whitePlayer.username}
              rating={whitePlayer.rating}
              clubAffiliation={whitePlayer.clubAffiliation}
              isGuest={whitePlayer.isGuest || false}
              capturedPieces={capturedByWhite}
              photoURL={whitePlayer.photoURL}
              isActive={activePlayer === 'white'}
            />
        {/* Bottom player timer (White) */}
            <div>
          <GameClock 
                timeInSeconds={gameTimeInSeconds}
            isActive={activePlayer === 'white'}
            isDarkTheme={true}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
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