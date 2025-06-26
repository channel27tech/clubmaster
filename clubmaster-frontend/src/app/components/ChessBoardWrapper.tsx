'use client';
import { useState, useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import PlayerInfo from './PlayerInfo';
import MoveControls from './MoveControls';
import GameClock from './GameClock';
import GameResultScreen from './GameResultScreen';
import WaitingScreen from './WaitingScreen';
import DisconnectionNotification from './DisconnectionNotification';
import { MoveHistoryState, BoardState } from '../utils/moveHistory';
import { getChessEngine, makeMove, resetChessEngine, setChessPosition, getGameStatus, getCurrentBoardState, isThreefoldRepetition, getFen, clearChessState } from '../utils/chessEngine';
import { useSocket } from '../../context/SocketContext';
import { useSound } from '../../context/SoundContext';
import { useAuth } from '../../context/AuthContext';
import { BetResult } from '@/types/bet';
import { 
  ProfileControlResult,
  ProfileLockResult, 
  RatingStakeResult 
} from './bet-results';
import { processResultData, getBetResultComponentProps } from '../utils/betResultHelper';
import { useBet } from '../../context/BetContext';
import { playSound, preloadSoundEffects } from '../utils/soundEffects';
import { fetchGamePlayers } from '../api/gameApi';
import { CapturedPiece, GameResultType, GameEndReason, GameResult, PlayerData } from '../utils/types';
import { saveBetResult } from '@/services/betResultService';
import useChessHistory from '../hooks/useChessHistory';

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
  onGameEnd?: (isWinner: boolean, isDraw: boolean) => void;
  currentMoveIndex?: number;
  onMoveIndexChange?: (moveIndex: number) => void;
}

// Fix the BoardState type issue by adding an interface or using the existing type
// Add this near the top of the file, around line 22
interface BoardState {
  squares: {
    position: string;
    piece: string | null;
  }[][];
}

// Fix the GameResult interface to ensure all properties have proper types
// Add this near the top of the file, around line 30, after the BoardState interface
interface ExtendedGameResult extends GameResult {
  playerRating: number;
  opponentRating: number;
  playerPhotoURL: string | null;
  opponentPhotoURL: string | null;
}

// Define the ref type for exposed methods
export interface ChessBoardWrapperRef {
  jumpToMove: (moveIndex: number) => void;
}

const ChessBoardWrapper = forwardRef<ChessBoardWrapperRef, ChessBoardWrapperProps>(
  function ChessBoardWrapper(
    { 
      playerColor, 
      timeControl = '5+0', 
      gameId = '', 
      onSanMoveListChange,
      onGameEnd,
      currentMoveIndex = -1, 
      onMoveIndexChange 
    },
    ref
  ) {
  // Get game ID from props or use derived from URL if available
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [gameRoomId, setGameRoomId] = useState<string>(gameId);
  
  // Track if the game is ready to accept moves
  // If we have a gameId at initialization, assume the game is ready
  const [isGameReady, setIsGameReady] = useState(!!gameId);
  
  // Helper function to safely save data to localStorage with error handling and cleanup
  const safeLocalStorage = {
    setItem: (key: string, value: any) => {
      try {
        // First try to remove any old game results (keep only the last 5)
        try {
          const allKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gameResult_')) {
              allKeys.push(key);
            }
          }
          
          // Sort by timestamp (assuming gameIds have timestamps) and remove oldest
          if (allKeys.length > 5) {
            allKeys.sort();
            const keysToRemove = allKeys.slice(0, allKeys.length - 5);
            keysToRemove.forEach(oldKey => {
              console.log(`Cleaning up old localStorage entry: ${oldKey}`);
              localStorage.removeItem(oldKey);
            });
          }
        } catch (e) {
          console.error('Error cleaning up old localStorage entries:', e);
        }
        
        // For game results, minimize the data to save space
        if (key.startsWith('gameResult_')) {
          const data = JSON.parse(JSON.stringify(value));
          
          // Keep only essential fields
          const minimalData = {
            result: data.result,
            reason: data.reason,
            playerName: data.playerName,
            opponentName: data.opponentName,
            playerRating: data.playerRating || 1500,
            opponentRating: data.opponentRating || 1500,
            playerRatingChange: data.playerRatingChange || 0,
            opponentRatingChange: data.opponentRatingChange || 0
          };
          
          // Try to save the minimal data
          localStorage.setItem(key, JSON.stringify(minimalData));
          console.log(`Saved minimal data to localStorage for ${key}`);
          return;
        }
        
        // For non-game results, save normally
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch (error) {
        console.error(`Failed to save to localStorage (${key}):`, error);
        
        // If quota exceeded, try to clear some space
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('localStorage quota exceeded, clearing all game results');
          try {
            // Clear all game results
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && key.startsWith('gameResult_')) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            console.error('Error clearing localStorage:', e);
          }
        }
      }
    },
    
    getItem: (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error(`Failed to read from localStorage (${key}):`, error);
        return null;
      }
    },
    
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove from localStorage (${key}):`, error);
      }
    }
  };

  // Helper function to create GameResult objects with proper typing
  const createGameResult = (
    result: GameResultType,
    reason: GameEndReason,
    playerName: string,
    opponentName: string,
    playerRating: number | undefined,
    opponentRating: number | undefined,
    playerRatingChange: number,
    opponentRatingChange: number,
    playerPhotoURL?: string | null,
    opponentPhotoURL?: string | null
  ): GameResult => {
    return {
      result,
      reason,
      playerName,
      opponentName,
      playerRating: playerRating || 0, // Provide default value
      opponentRating: opponentRating || 0, // Provide default value
      playerRatingChange,
      opponentRatingChange,
      playerPhotoURL: playerPhotoURL || null,
      opponentPhotoURL: opponentPhotoURL || null
    }
  };
  
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
  
  // Use the chess history hook
  const {
    moveHistory,
    boardState,
    lastMove,
    isViewingHistory,
    updateMoveHistory,
    updateBoardState,
    setLastMove,
    appendMove,
    goBack,
    goForward,
    jumpToMove,
    exitHistoryMode
  } = useChessHistory();
  
  const [sanMoveList, setSanMoveList] = useState<string[]>([]);
  
  // Add a ref to track the previous position to prevent unnecessary updates
  const previousPositionRef = useRef<number>(-1);
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    jumpToMove: (moveIndex: number) => {
      console.log(`[ChessBoardWrapper] jumpToMove called with index: ${moveIndex}`);
      jumpToMove(moveIndex);
    }
  }), [jumpToMove]);
  
  // Respond to currentMoveIndex changes from parent
  useEffect(() => {
    // Only update if currentMoveIndex has actually changed
    if (
      currentMoveIndex !== undefined &&
      moveHistory.currentMoveIndex !== currentMoveIndex &&
      previousPositionRef.current !== currentMoveIndex
    ) {
      previousPositionRef.current = currentMoveIndex;
      jumpToMove(currentMoveIndex);
    }
    // Only depend on currentMoveIndex and jumpToMove
  }, [currentMoveIndex, jumpToMove, moveHistory.currentMoveIndex]);
  
  // Notify parent when move index changes internally
  useEffect(() => {
    if (
      onMoveIndexChange &&
      moveHistory.currentMoveIndex !== currentMoveIndex &&
      previousPositionRef.current !== moveHistory.currentMoveIndex
    ) {
      previousPositionRef.current = moveHistory.currentMoveIndex;
      onMoveIndexChange(moveHistory.currentMoveIndex);
    }
    // Only depend on moveHistory.currentMoveIndex and onMoveIndexChange
  }, [moveHistory.currentMoveIndex, onMoveIndexChange, currentMoveIndex]);
  
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
    // Log initial state with isGameReady status
    console.log(`[ChessBoardWrapper] Component mounted - gameId: ${gameId}, isGameReady: ${isGameReady}`);
  }, []);
  
  // Fix the player data fetch useEffect to prevent infinite re-renders
  // Around line 200
  // Fetch real player data for the game
  useEffect(() => {
    // Track if the component is still mounted
    let isMounted = true;
    
    if (!gameRoomId) {
      console.log('No gameRoomId provided, skipping player data fetch');
      return;
    }
    
    // Function to fetch player data with retries
    const fetchPlayersWithRetries = async (retries = 3, delay = 2000) => {
      let lastError = null;
      
      // Set initial loading state only if component is still mounted
      if (isMounted) {
        setLoadingPlayers(true);
        setPlayerDataError(null);
      }
      
      // Check if this is a bet game for logging
      const isBetGame = localStorage.getItem('isBetGame') === 'true';
      const betType = localStorage.getItem('betType');
      console.log(`[ChessBoardWrapper] Fetching player data for game ${gameRoomId} (isBetGame=${isBetGame}, betType=${betType})`);
      
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          console.log(`[ChessBoardWrapper] Fetching player data attempt ${attempt + 1}/${retries} for game ID: ${gameRoomId}`);
          const data = await fetchGamePlayers(gameRoomId);
          
          // If component unmounted during the fetch, abort
          if (!isMounted) {
            console.log('[ChessBoardWrapper] Component unmounted during fetch, aborting player data update');
            return;
          }
          
          // Validate that we have real player data
          if (!data || !data.whitePlayer || !data.blackPlayer) {
            console.warn('[ChessBoardWrapper] Invalid player data format received:', data);
            throw new Error('Invalid player data format received');
          }
          
          const hasValidWhitePlayer = data.whitePlayer.username && data.whitePlayer.username !== 'Loading...';
          const hasValidBlackPlayer = data.blackPlayer.username && data.blackPlayer.username !== 'Loading...';
          
          if (!hasValidWhitePlayer || !hasValidBlackPlayer) {
            console.warn('[ChessBoardWrapper] Incomplete player data received, retrying...', { 
              whiteUsername: data.whitePlayer.username, 
              blackUsername: data.blackPlayer.username 
            });
            throw new Error('Incomplete player data received');
          }
          
          console.log('[ChessBoardWrapper] Player data fetched successfully:', {
            white: `${data.whitePlayer.username} (${data.whitePlayer.rating})`,
            black: `${data.blackPlayer.username} (${data.blackPlayer.rating})`
          });
          
          // Only update state if component is still mounted
          if (isMounted) {
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
          }
          return; // Success, exit the retry loop
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || 'Unknown error';
          console.error(`[ChessBoardWrapper] Error fetching player data (Attempt ${attempt + 1}/${retries}): ${errorMessage}`, error);
          
          // If we have more retries and component is still mounted, wait before trying again
          if (attempt < retries - 1 && isMounted) {
            console.log(`[ChessBoardWrapper] Waiting ${delay}ms before retry ${attempt + 2}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we get here, all retries failed
      console.error(`[ChessBoardWrapper] All ${retries} attempts to fetch player data failed. Last error:`, lastError);
      
      // Only update state if component is still mounted
      if (isMounted) {
        setPlayerDataError(`Failed to load player data after ${retries} attempts`);
        setLoadingPlayers(false);
        
        // Set generic placeholder data as a last resort
        console.log('[ChessBoardWrapper] Setting placeholder player data after all retries failed');
        
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
      }
      // Set generic placeholder data as a last resort
      console.log('Setting placeholder player data after all retries failed');
      
      setWhitePlayer({
        username: isGuest && user && user.displayName ? user.displayName : 'White Player',
        rating: 1500,
        capturedPieces: capturedByWhite,
        isGuest: isGuest,
        photoURL: null,
        userId: undefined
      });
      
      setBlackPlayer({
        username: isGuest && user && user.displayName ? user.displayName : 'Black Player',
        rating: 1500,
        capturedPieces: capturedByBlack,
        isGuest: isGuest,
        photoURL: null,
        userId: undefined
      });
    };
    
    // Start the fetch process with retries
    fetchPlayersWithRetries();
    
    // Set up a periodic refresh to ensure player data stays up-to-date
    // Use a longer interval (60 seconds) to reduce unnecessary API calls
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        console.log('[ChessBoardWrapper] Periodic refresh of player data');
        fetchPlayersWithRetries(2, 1000); // Fewer retries for periodic refresh
      }
    }, 60000); // Refresh every 60 seconds
    
    // Clean up interval on unmount
    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [gameRoomId]); // Only depend on gameRoomId, not capturedByWhite/Black which change frequently
  
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
  
  // Track remaining time for each player separately
  const [whiteTimeRemaining, setWhiteTimeRemaining] = useState<number>(gameTimeInSeconds);
  const [blackTimeRemaining, setBlackTimeRemaining] = useState<number>(gameTimeInSeconds);
  
  // Use refs to track the latest time values (for use in callbacks)
  const whiteTimeRemainingRef = useRef<number>(gameTimeInSeconds);
  const blackTimeRemainingRef = useRef<number>(gameTimeInSeconds);
  
  // Update refs when state changes
  useEffect(() => {
    whiteTimeRemainingRef.current = whiteTimeRemaining;
  }, [whiteTimeRemaining]);
  
  useEffect(() => {
    blackTimeRemainingRef.current = blackTimeRemaining;
  }, [blackTimeRemaining]);
  
  // Handle time updates from the GameClock component
  const handleWhiteTimeUpdate = useCallback((newTime: number) => {
    setWhiteTimeRemaining(newTime);
  }, []);
  
  const handleBlackTimeUpdate = useCallback((newTime: number) => {
    setBlackTimeRemaining(newTime);
  }, []);
  
  // Reset times when game starts or time control changes
  useEffect(() => {
    setWhiteTimeRemaining(gameTimeInSeconds);
    setBlackTimeRemaining(gameTimeInSeconds);
    whiteTimeRemainingRef.current = gameTimeInSeconds;
    blackTimeRemainingRef.current = gameTimeInSeconds;
    console.log(`[TIME] Reset both player clocks to ${gameTimeInSeconds} seconds`);
  }, [gameTimeInSeconds]);
  
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
  
  // Define the updateCapturedPieces function at component level
  const updateCapturedPieces = useCallback(() => {
    try {
    if (!moveHistory) return;
    
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
  }, [moveHistory, setCapturedByWhite, setCapturedByBlack]);
  
  // Track captured pieces
  useEffect(() => {
    if (!moveHistory) return;
    
    // Update captured pieces whenever move history changes
    updateCapturedPieces();
  }, [moveHistory, updateCapturedPieces]);

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
    safeSocket.on('draw_request', (data) => {
      console.log('Received draw request from opponent:', data);
      setDrawOfferReceived(true);
      
      // Play notification sound if enabled
      if (soundEnabledRef.current) {
        playSound('NOTIFICATION', true);
      }
      
      // Set a timeout to auto-decline after 30 seconds
      const timeout = setTimeout(() => {
        console.log('Draw offer timed out, auto-declining');
        setDrawOfferReceived(false);
        safeSocket.emit('draw_response', { 
          gameId: gameRoomId,
          accepted: false 
        });
      }, 30000);
      
      setDrawOfferTimeout(timeout);
      
      // Reset and start countdown
      setDrawOfferTimeRemaining(30);
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
    
    safeSocket.on('move_made', ({ player, isCapture, isCheck, from, to, san, notation, fen, moveId, promotion }) => {
      console.log(`[SERVER EVENT] Received move_made broadcast - player: ${player}, from: ${from}, to: ${to}, promotion: ${promotion}`);
      
      // CRITICAL: Do NOT add this server-broadcast move to the moveQueue
      // Instead, directly apply it to our local chess engine
      
      try {
        const chess = getChessEngine();
      
        // If we have a FEN, use it for full synchronization (most reliable)
        if (fen) {
          console.log(`[SYNC] Using server-provided FEN for synchronization: ${fen}`);
          chess.load(fen);
        }
        // Otherwise try SAN notation
        else if (san) {
          console.log(`[SYNC] Using SAN notation for move: ${san}`);
          chess.move(san);
        }
        // Or try to reconstruct the move
        else {
          console.log(`[SYNC] Reconstructing move from: ${from}, to: ${to}, promotion: ${promotion || 'none'}`);
        
          // If this is a promotion move, include the promotion piece
          if (promotion) {
            chess.move({
              from,
              to,
              promotion: promotion.toLowerCase().charAt(0)
            });
      } else {
            chess.move({
              from,
              to
            });
          }
        }
        
        // Get the current FEN after applying the move
        const currentFen = chess.fen();
        
        // Get the current move history
        const history = chess.history();
        
        // Update the SAN move list
        setSanMoveList(history);
        
        // Notify parent component if callback is provided
        if (onSanMoveListChange) {
          onSanMoveListChange(history);
        }
        
        // Update the active player
        setActivePlayer(chess.turn() === 'w' ? 'white' : 'black');
        
        // Update the last move
        setLastMove({ from, to });
        
        // Play move sound
        playSound(isCapture ? 'CAPTURE' : 'MOVE', soundEnabledRef.current);
        
        // Check if the game is over after this move
        const isGameOver = chess.isGameOver();
        
        if (isGameOver) {
          console.log('[GAME OVER] Game is over after move');
          
          // Determine the reason for game over
          let gameOverReason = '';
          
          if (chess.isCheckmate()) {
            gameOverReason = 'checkmate';
            playSound('CHECKMATE', soundEnabledRef.current);
          } else if (chess.isDraw()) {
            if (chess.isStalemate()) {
              gameOverReason = 'stalemate';
            } else if (chess.isThreefoldRepetition()) {
              gameOverReason = 'repetition';
            } else if (chess.isInsufficientMaterial()) {
              gameOverReason = 'insufficient_material';
        } else {
              gameOverReason = 'draw';
            }
            playSound('DRAW', soundEnabledRef.current);
          }
          
          // Update game state
          setGameState({
            ...gameState,
            isGameOver: true,
            gameOverReason
          });
          
          // Stop the clocks
          setActivePlayer(null);
        }
        // If not game over but check, play check sound
        else if (isCheck) {
          playSound('CHECK', soundEnabledRef.current);
        }
        
        // Update captured pieces
        updateCapturedPieces();
        
        // Dispatch a game state updated event
        window.dispatchEvent(new CustomEvent('game_state_updated', {
          detail: {
            fen: currentFen,
            isGameOver,
            gameOverReason: isGameOver ? (chess.isCheckmate() ? 'checkmate' : chess.isDraw() ? 'draw' : '') : '',
            activePlayer: chess.turn() === 'w' ? 'white' : 'black'
          }
        }));
      } catch (error) {
        console.error('[ERROR] Failed to process move from server:', error);
        
        // Request a board sync from the server
        socket.emit('request_board_sync', {
          gameId: gameRoomId,
          reason: 'move_processing_failed',
          clientState: getChessEngine().fen()
        });
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
      safeSocket.off('draw_request');
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
          gameOverReason: 'abort' // Set explicit abort reason
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
              const abortResultData: ExtendedGameResult = {
                result: 'draw',
                reason: 'abort',
                playerName: playerColor === 'white' ? updatedWhitePlayer.username : updatedBlackPlayer.username,
                opponentName: playerColor === 'white' ? updatedBlackPlayer.username : updatedWhitePlayer.username,
                playerRating: playerColor === 'white' ? Number(updatedWhitePlayer.rating || 1500) : Number(updatedBlackPlayer.rating || 1500),
                opponentRating: playerColor === 'white' ? Number(updatedBlackPlayer.rating || 1500) : Number(updatedWhitePlayer.rating || 1500),
                playerPhotoURL: playerColor === 'white' ? updatedWhitePlayer.photoURL : updatedBlackPlayer.photoURL,
                opponentPhotoURL: playerColor === 'white' ? updatedBlackPlayer.photoURL : updatedWhitePlayer.photoURL,
                playerRatingChange: 0, // No rating change on abort
                opponentRatingChange: 0  // No rating change on abort
              };
              
              console.log('Created game result data for abort with real player data:', abortResultData);
              
              // Set the game result data and show the result screen
              setGameResultData(abortResultData);
              setShowResultScreen(true);
              
              // For aborted games, always treat as a draw (not a win or loss)
              // Check if this is a bet game before calling onGameEnd
              const isBetGameFromStorage = localStorage.getItem('isBetGame') === 'true';
              const hasBetType = !!localStorage.getItem('betType');
              
              // Only call onGameEnd for confirmed bet games
              if (onGameEnd && isBetGameFromStorage === true && hasBetType) {
                console.log('Calling onGameEnd for aborted bet game with draw result');
                onGameEnd(false, true); // Not a winner, is a draw
              } else {
                // Clear any lingering bet data for regular games
                console.log('Clearing bet data for aborted regular game');
                localStorage.removeItem('isBetGame');
                localStorage.removeItem('betType');
                localStorage.removeItem('betId');
                localStorage.removeItem('opponentId');
              }
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
              const abortResultData: ExtendedGameResult = {
                result: 'draw',
                reason: 'abort',
                playerName: playerColor === 'white' ? fallbackWhitePlayer.username : fallbackBlackPlayer.username,
                opponentName: playerColor === 'white' ? fallbackBlackPlayer.username : fallbackWhitePlayer.username,
                playerRating: playerColor === 'white' ? Number(fallbackWhitePlayer.rating || 1500) : Number(fallbackBlackPlayer.rating || 1500),
                opponentRating: playerColor === 'white' ? Number(fallbackBlackPlayer.rating || 1500) : Number(fallbackWhitePlayer.rating || 1500),
                playerPhotoURL: playerColor === 'white' ? fallbackWhitePlayer.photoURL ?? null : fallbackBlackPlayer.photoURL ?? null,
                opponentPhotoURL: playerColor === 'white' ? fallbackBlackPlayer.photoURL ?? null : fallbackWhitePlayer.photoURL ?? null,
                playerRatingChange: 0, // No rating change on abort
                opponentRatingChange: 0  // No rating change on abort
              };
              
              console.log('Created game result data for abort with fallback values:', abortResultData);
              
              // Set the game result data and show the result screen
              setGameResultData(abortResultData);
              setShowResultScreen(true);
              
              // For aborted games, always treat as a draw (not a win or loss)
              // Check if this is a bet game before calling onGameEnd
              const isBetGameFromStorage = localStorage.getItem('isBetGame') === 'true';
              const hasBetType = !!localStorage.getItem('betType');
              
              // Only call onGameEnd for confirmed bet games
              if (onGameEnd && isBetGameFromStorage === true && hasBetType) {
                console.log('Calling onGameEnd for aborted bet game with draw result');
                onGameEnd(false, true); // Not a winner, is a draw
              } else {
                // Clear any lingering bet data for regular games
                console.log('Clearing bet data for aborted regular game');
                localStorage.removeItem('isBetGame');
                localStorage.removeItem('betType');
                localStorage.removeItem('betId');
                localStorage.removeItem('opponentId');
              }
            });
        } else {
          // We already have real player data, use it directly
          console.log('Using existing real player data for abort');
          
          // Create game result data with existing player data
          const abortResultData: ExtendedGameResult = {
            result: 'draw',
            reason: 'abort',
            playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
            opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
            playerRating: playerColor === 'white' ? Number(whitePlayer.rating || 1500) : Number(blackPlayer.rating || 1500),
            opponentRating: playerColor === 'white' ? Number(blackPlayer.rating || 1500) : Number(whitePlayer.rating || 1500),
            playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL ?? null : blackPlayer.photoURL ?? null,
            opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL ?? null : whitePlayer.photoURL ?? null,
            playerRatingChange: 0, // No rating change on abort
            opponentRatingChange: 0  // No rating change on abort
          };
          
          console.log('Created game result data for abort with existing player data:', abortResultData);
          
          // Set the game result data and show the result screen
          setGameResultData(abortResultData);
          setShowResultScreen(true);
          
          // For aborted games, always treat as a draw (not a win or loss)
          // Check if this is a bet game before calling onGameEnd
          const isBetGameFromStorage = localStorage.getItem('isBetGame') === 'true';
          const hasBetType = !!localStorage.getItem('betType');
          
          // Only call onGameEnd for confirmed bet games
          if (onGameEnd && isBetGameFromStorage === true && hasBetType) {
            console.log('Calling onGameEnd for aborted bet game with draw result');
            onGameEnd(false, true); // Not a winner, is a draw
          } else {
            // Clear any lingering bet data for regular games
            console.log('Clearing bet data for aborted regular game');
            localStorage.removeItem('isBetGame');
            localStorage.removeItem('betType');
            localStorage.removeItem('betId');
            localStorage.removeItem('opponentId');
          }
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
          playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL ?? null : blackPlayer.photoURL ?? null,
          opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL ?? null : whitePlayer.photoURL ?? null,
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
          playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL ?? null : blackPlayer.photoURL ?? null,
          opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL ?? null : whitePlayer.photoURL ?? null,
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
      safeSocket.off('draw_request');
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
    if (!socket || !moveQueue.length || !gameRoomId) {
      if (moveQueue.length > 0 && !socket) {
        console.warn('[ChessBoardWrapper] Move queue not processed: No socket connection');
      } else if (moveQueue.length > 0 && !gameRoomId) {
        console.warn('[ChessBoardWrapper] Move queue not processed: No game room ID');
      }
      return;
    }
    
    console.log(`[ChessBoardWrapper] Processing move queue (${moveQueue.length} moves) for game ${gameRoomId}, isGameReady: ${isGameReady}`);

    // Block move sending if game is not ready
    if (!isGameReady) {
      console.warn('[ChessBoardWrapper] Move blocked: game is not ready yet. GameID:', gameRoomId);
      console.warn('[ChessBoardWrapper] Move details:', {
        from: moveQueue[0].from,
        to: moveQueue[0].to,
        player: moveQueue[0].player
      });
      return;
    }
    
    const move = moveQueue[0];
    const currentSocket = socket; // Capture current socket to avoid closure issues
    
    // Only send the move to the server, do not apply it locally again
    // (it's already been applied by the local move handler in ChessBoard.tsx)
    const sendMoveToServer = () => {
      try {
        console.log(`[OUTGOING] Sending move to server: ${move.from} to ${move.to}${move.promotion ? ', promotion: ' + move.promotion : ''}`);
        
        // Use the player color stored with the move
        const currentPlayerColor = move.player;
        
        if (!currentPlayerColor) {
          console.error('[ERROR] No player color specified with move');
          setMoveQueue(prev => prev.slice(1));
          return;
        }
        
        // Ensure we have a valid socket connection
        if (!socket || !socket.connected) {
          console.error('[ERROR] No socket connection available');
              setMoveQueue(prev => prev.slice(1));
              return;
        }
        
        // Get the current chess engine instance
        const chess = getChessEngine();
        const currentFen = chess.fen();
        
        // Get the current move history
        const history = chess.history({ verbose: true });
        const lastMoveVerbose = history.length > 0 ? history[history.length - 1] : null;
          
        // Check if this is a pawn promotion move
        if (move.promotion) {
          console.log(`[PROMOTION] Sending promotion move with piece: ${move.promotion}`);
        }
        
        // Create a unique move ID for tracking
        const moveId = `${move.from}-${move.to}-${Date.now()}`;
          
        // Emit the move to the server
        socket.emit('move_made', {
            gameId: gameRoomId,
          moveId,
                from: move.from,
                to: move.to,
                player: currentPlayerColor,
          notation: move.notation || undefined,
                promotion: move.promotion,
          isCapture: move.isCapture || lastMoveVerbose?.captured !== undefined,
          fen: currentFen,
          san: lastMoveVerbose?.san || undefined,
          timestamp: Date.now()
        });
        
        // Remove the move from the queue
        setMoveQueue(prev => prev.slice(1));
      } catch (error) {
        console.error('[ERROR] Failed to send move to server:', error);
        // Remove the move from the queue even if it failed
        setMoveQueue(prev => prev.slice(1));
      }
    };

    // Send the move to the server
    sendMoveToServer();
    // Don't remove the move from the queue immediately - wait for server confirmation
  }, [socket, moveQueue, gameRoomId, sanMoveList, isGameReady]);
  
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
      // Skip updates if the game IDs don't match
      if (data.gameId !== gameRoomId) {
        console.log(`[handleBoardUpdated] Ignoring update for different game: ${data.gameId} vs ${gameRoomId}`);
        return;
      }

      // Only update board state if not viewing history
      if (!isViewingHistory) {
        // Process the move history from the server
        console.log(`[handleBoardUpdated] Processing move history update for game ${data.gameId}`);
        
        try {
      // Check if the game is already over
      if (gameState.isGameOver) {
        console.log('Game is already over, ignoring board_updated event');
        return;
      }
      
      console.log(`Received board_updated event for game ${data.gameId} with ${data.moveHistory.length} moves, whiteTurn=${data.whiteTurn}`);
      
        // Always update the chess engine state with the server's FEN if provided
        if (data.fen) {
          setChessPosition(data.fen, gameRoomId);
        }
        
        // Mark the game as ready to accept moves if we receive valid game data
        if (!isGameReady && data.gameId === gameRoomId) {
          setIsGameReady(true);
          console.log('[ChessBoardWrapper] Game is now ready for moves (from board_updated):', gameRoomId);
        }
      
        // CRITICAL: Always update the active player first if whiteTurn is provided
        // This ensures clocks and turn indicators stay in sync, regardless of other updates
        if (data.whiteTurn !== undefined) {
          const newActivePlayer = data.whiteTurn ? 'white' : 'black';
          if (activePlayer !== newActivePlayer) {
            console.log(`[TURN] Updating active player from ${activePlayer} to ${newActivePlayer} (whiteTurn=${data.whiteTurn})`);
            setActivePlayer(newActivePlayer);
          
            // Also update the game state to reflect the current turn
            setGameState(prevState => ({
              ...prevState,
              isWhiteTurn: data.whiteTurn,
              hasWhiteMoved: data.moveHistory && data.moveHistory.length > 0 ? true : prevState.hasWhiteMoved
            }));
          } else {
            console.log(`[TURN] Active player already set to ${activePlayer}, no update needed`);
          }
        } else {
          console.warn('[TURN] No whiteTurn value provided in board_updated event');
        }
        
        // Check if the move history has actually changed
        const moveHistoryChanged = JSON.stringify(data.moveHistory) !== JSON.stringify(sanMoveList);
        
        if (!moveHistoryChanged) {
          console.log('Move history unchanged, skipping further update');
          return;
        }
        
                  // Synchronize the board using move history as the primary source of truth
        const syncResult = synchronizeBoardFromMoveHistory(data.moveHistory);
        if (syncResult) {
          // Update the board state from the new position
          const newBoardState = getCurrentBoardState();
          
          // Check if the board state has actually changed
          const boardStateChanged = JSON.stringify(newBoardState) !== JSON.stringify(boardState);
          
          if (!boardStateChanged && data.moveHistory.length === sanMoveList.length) {
            console.log('Board state unchanged, skipping update');
            return;
          }
              
          // Always update the move history
          setSanMoveList(data.moveHistory);
          if (onSanMoveListChange) onSanMoveListChange(data.moveHistory);
          
          // Prepare updates
          const updates: any = {};
          
          // Update last move if provided
          if (data.lastMove) {
            const matches = data.lastMove.match(/[a-h][1-8]/g) || [];
            if (matches.length >= 2) {
              const from = matches[0];
              const to = matches[1];
              updates.lastMove = { from, to };
            }
          }
          
          // Check if we're in review mode (viewing a historical move)
          const isReviewMode = moveHistory && moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0;
          
          // Only update the visible board state if we're not in review mode
          if (!isReviewMode) {
            console.log('Not in review mode, updating visible board state');
              updateBoardState(newBoardState);
            if (updates.lastMove) setLastMove(updates.lastMove);
          } else {
            console.log('In review mode, preserving historical view (not updating visible board state)');
            // Even in review mode, we should update the underlying move history
            // This ensures that when the user exits review mode, they'll see the latest state
          }
          
          console.log('Successfully processed board update');
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
      } catch (error) {
        console.error('Error processing board update:', error);
        // Request a full board sync if we fail to process the update
        if (socket && gameRoomId) {
          socket.emit('request_board_sync', {
            gameId: gameRoomId,
            reason: 'board_update_processing_failed',
            clientState: getChessEngine().fen()
          });
        }
        }
      } else {
        console.log('[handleBoardUpdated] Ignoring board update while viewing history');
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
      
      console.log(`Received board_sync event for game ${data.gameId} with FEN: ${data.fen}, whiteTurn=${data.whiteTurn}`);
      
      try {
        // Mark the game as ready to accept moves if we receive valid game data
        if (!isGameReady && data.gameId === gameRoomId) {
          setIsGameReady(true);
          console.log('[ChessBoardWrapper] Game is now ready for moves (from board_sync):', gameRoomId);
        }
        
        // CRITICAL: Always update the active player first if whiteTurn is provided
        // This ensures clocks and turn indicators stay in sync, regardless of other updates
        if (data.whiteTurn !== undefined) {
          const newActivePlayer = data.whiteTurn ? 'white' : 'black';
          if (activePlayer !== newActivePlayer) {
            console.log(`[TURN] Updating active player from ${activePlayer} to ${newActivePlayer} (whiteTurn=${data.whiteTurn})`);
            setActivePlayer(newActivePlayer);
            
            // Also update the game state to reflect the current turn
            setGameState(prevState => ({
              ...prevState,
              isWhiteTurn: data.whiteTurn === undefined ? prevState.isWhiteTurn : data.whiteTurn,
              hasWhiteMoved: (data.moveHistory !== undefined && data.moveHistory.length > 0) ? true : prevState.hasWhiteMoved
            }));
          } else {
            console.log(`[TURN] Active player already set to ${activePlayer}, no update needed`);
          }
        } else {
          console.warn('[TURN] No whiteTurn value provided in board_sync event');
        }
      
        // Always set the FEN position first
        setChessPosition(data.fen, gameRoomId);
        
        // If move history is available, use it to update the move list
        if (data.moveHistory && data.moveHistory.length > 0) {
          console.log(`Using move history from board_sync event (${data.moveHistory.length} moves)`);
          
          // Check if the move history has actually changed
          const moveHistoryChanged = JSON.stringify(data.moveHistory) !== JSON.stringify(sanMoveList);
          
          if (moveHistoryChanged) {
            setSanMoveList(data.moveHistory);
            if (onSanMoveListChange) onSanMoveListChange(data.moveHistory);
            
            // Process the move history update
          }
        }
        
        // Update the board state from the new position
        const newBoardState = getCurrentBoardState();
        
        // Check if the board state has actually changed to prevent unnecessary updates
        const boardStateChanged = JSON.stringify(newBoardState) !== JSON.stringify(boardState);
        
        if (!boardStateChanged) {
          console.log('Board state unchanged, skipping update');
          return;
        }
        
        // Check if we're in review mode (viewing a historical move)
        const isReviewMode = moveHistory && moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0;
        
        // Only update the visible board state if we're not in review mode
        if (!isReviewMode) {
          console.log('Not in review mode, updating visible board state');
          updateBoardState(newBoardState);
        } else {
          console.log('In review mode, preserving historical view (not updating visible board state)');
          // Even in review mode, we should update the underlying move history
          // This ensures that when the user exits review mode, they'll see the latest state
        }
        
        console.log('Successfully processed board sync');
      } catch (error) {
        console.error('Failed to synchronize board state:', error);
      }
    };
    
    socket.on('board_sync', handleBoardSync);
    
    // Handle game_end event from server
    const handleGameEnd = (data: any) => {
      console.log('Received game_end event:', data);
      console.log('Player color:', playerColor);
      
      // Log the reason for game end
      console.log(`Game end reason: ${data.reason}`);
      
      // Additional logging for timeout events
      if (data.reason === 'timeout') {
        console.log('[TIMEOUT] Received game_end with timeout reason', {
          winnerColor: data.winnerColor,
          loserColor: data.loserColor,
          playerColor,
          shouldWin: (playerColor === 'white' && data.winnerColor === 'white') || 
                     (playerColor === 'black' && data.winnerColor === 'black')
        });
      }
      
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
      
      // For aborted games, always treat as a draw with no rating change
      if (data.reason === 'abort') {
        console.log('Game was aborted. Setting result as draw with no rating change.');
        
        const resultData = {
          result: 'draw' as GameResultType,
          reason: 'abort' as GameEndReason,
          playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
          opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
          playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
          opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL ?? null : blackPlayer.photoURL ?? null,
          opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL ?? null : whitePlayer.photoURL ?? null,
          playerRatingChange: 0, // No rating change on abort
          opponentRatingChange: 0 // No rating change on abort
        };
        
        console.log('Abort result data:', resultData);
        
        // Save the game result to localStorage for the result page to use
        safeLocalStorage.setItem(`gameResult_${gameRoomId}`, resultData);
        console.log('Saved aborted game result to localStorage');
        
        // IMPORTANT: For aborted games, we should NEVER redirect to bet result pages
        // Explicitly check and clear any bet game data
        safeLocalStorage.removeItem('isBetGame');
        safeLocalStorage.removeItem('betType');
        safeLocalStorage.removeItem('betId');
        safeLocalStorage.removeItem('opponentId');
        
        // Navigate to regular result page
        const gameEndedEvent = new CustomEvent('game_ended', {
          detail: resultData
        });
        
        // Dispatch the event to trigger the game result screen
        window.dispatchEvent(gameEndedEvent);
        
        console.log('Dispatched game_ended event for aborted game');
        return;
      }
      
      // Determine the result from the player's perspective
      let playerResult: GameResultType = 'draw';
      
      // Debug log all data fields to help diagnose the issue
      console.log('Game end data fields:', {
        reason: data.reason,
        winner: data.winner,
        resigner: data.resigner,
        timedOut: data.timedOut,
        playerColor,
        whitePlayer: whitePlayer.username,
        blackPlayer: blackPlayer.username
      });
      
      // Handle specific game end reasons
      if (data.reason === 'checkmate') {
        // For checkmate, determine the winner based on the data from the server
        // If data.winner is not specified, infer it from the last move
        let winner = data.winner;
        
        // If winner is not explicitly provided, determine it based on who made the last move
        if (!winner && data.lastMoveBy) {
          // The player who made the last move is the winner in checkmate
          winner = data.lastMoveBy;
          console.log(`Winner not explicitly provided, inferring from lastMoveBy: ${winner}`);
        }
        
        // If we still don't have a winner, try to determine from the game state
        if (!winner) {
          // In checkmate, the player whose turn it is has lost (they're in checkmate)
          const isWhiteTurn = data.whiteTurn !== undefined ? data.whiteTurn : (moveHistory?.moves?.length % 2 === 0);
          winner = isWhiteTurn ? 'black' : 'white';
          console.log(`Winner still not determined, inferring from turn: ${winner} (whiteTurn: ${isWhiteTurn})`);
        }
        
        const isPlayerWinner = 
          (playerColor === 'white' && winner === 'white') ||
          (playerColor === 'black' && winner === 'black');
        playerResult = isPlayerWinner ? 'win' : 'loss';
        console.log(`Checkmate detected. Player is ${playerColor}, winner is ${winner}, playerResult: ${playerResult}`);
      }
      else if (data.reason === 'resignation') {
        // For resignation, the winner is the opposite of the resigner
        const isPlayerResigned = 
          (playerColor === 'white' && data.resigner === 'white') ||
          (playerColor === 'black' && data.resigner === 'black');
        playerResult = isPlayerResigned ? 'loss' : 'win';
        console.log(`Resignation detected. Player is ${playerColor}, resigner is ${data.resigner}, playerResult: ${playerResult}`);
      }
      else if (data.reason === 'timeout') {
        // For timeout events, we've already shown the appropriate screen in handleTimeOut
        // We'll just use this event to update rating changes if available
        console.log(`Received game_end with timeout reason - using for rating updates only`);
        console.log(`Game end data:`, data);
        
        try {
          // Get the stored timeout player from localStorage
          const timedOutPlayer = safeLocalStorage.getItem(`timeout_player_${gameRoomId}`);
          console.log(`Retrieved timedOutPlayer from localStorage: ${timedOutPlayer}`);
          
          // Skip showing another result screen since we already showed it in handleTimeOut
          console.log(`Skipping result screen for timeout since it was already shown`);
          
          // Just update the rating changes if they're available
          if (data.whitePlayer?.ratingChange !== undefined && data.blackPlayer?.ratingChange !== undefined) {
            console.log(`Updating rating changes: white=${data.whitePlayer.ratingChange}, black=${data.blackPlayer.ratingChange}`);
            
            // Get the current result data
            const currentResultData = { ...gameResultData };
            
            // Update rating changes
            currentResultData.playerRatingChange = playerColor === 'white' ? 
              data.whitePlayer.ratingChange : data.blackPlayer.ratingChange;
            currentResultData.opponentRatingChange = playerColor === 'white' ? 
              data.blackPlayer.ratingChange : data.whitePlayer.ratingChange;
            
            // Update the result data
            setGameResultData(currentResultData);
            
            console.log(`Updated result data with rating changes:`, currentResultData);
          }
          
          // Return early to skip showing another result screen
          return;
        } catch (error) {
          console.error('Error handling timeout game_end event:', error);
          
          // Fallback to the old method if there's an error
          const isPlayerTimedOut = 
            (playerColor === 'white' && (data.timedOut === 'white' || data.loserColor === 'white')) ||
            (playerColor === 'black' && (data.timedOut === 'black' || data.loserColor === 'black'));
          
          playerResult = isPlayerTimedOut ? 'loss' : 'win';
          
          // Only show the result screen if it's not already showing
          if (showResultScreen) {
            console.log(`Result screen already showing, skipping`);
            return;
          }
          
          console.log(`Fallback timeout handling. Player is ${playerColor}, isTimedOut: ${isPlayerTimedOut}, playerResult: ${playerResult}`);
        }
      }
      else if (['draw_agreement', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_move_rule'].includes(data.reason)) {
        // These are all draw conditions
        playerResult = 'draw';
        console.log(`Draw condition detected: ${data.reason}`);
      }
      else if (data.winner) {
        // Generic winner determination for other cases
        const isPlayerWinner = 
          (playerColor === 'white' && data.winner === 'white') ||
          (playerColor === 'black' && data.winner === 'black');
        playerResult = isPlayerWinner ? 'win' : 'loss';
        console.log(`Generic winner determination. Player is ${playerColor}, winner is ${data.winner}, playerResult: ${playerResult}`);
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
        // Check for rating changes in multiple possible locations in the payload
        playerRatingChange: playerColor === 'white' 
          ? (data.whitePlayer?.ratingChange !== undefined 
             ? data.whitePlayer.ratingChange 
             : (data.whiteRatingChange?.ratingChange !== undefined 
                ? data.whiteRatingChange.ratingChange 
                : 0))
          : (data.blackPlayer?.ratingChange !== undefined 
             ? data.blackPlayer.ratingChange 
             : (data.blackRatingChange?.ratingChange !== undefined 
                ? data.blackRatingChange.ratingChange 
                : 0)),
        opponentRatingChange: playerColor === 'white' 
          ? (data.blackPlayer?.ratingChange !== undefined 
             ? data.blackPlayer.ratingChange 
             : (data.blackRatingChange?.ratingChange !== undefined 
                ? data.blackRatingChange.ratingChange 
                : 0))
          : (data.whitePlayer?.ratingChange !== undefined 
             ? data.whitePlayer.ratingChange 
             : (data.whiteRatingChange?.ratingChange !== undefined 
                ? data.whiteRatingChange.ratingChange 
                : 0))
      };
      
      // Log the rating changes for debugging
      console.log('Rating changes extracted from payload:', {
        whiteRatingChange: data.whitePlayer?.ratingChange || data.whiteRatingChange?.ratingChange,
        blackRatingChange: data.blackPlayer?.ratingChange || data.blackRatingChange?.ratingChange,
        playerRatingChange: resultData.playerRatingChange,
        opponentRatingChange: resultData.opponentRatingChange
      });
      
      console.log('Final result data:', resultData);
      
      // Save the game result to localStorage for the result page to use
      safeLocalStorage.setItem(`gameResult_${gameRoomId}`, resultData);
      console.log('Saved game result to localStorage');
      
      // Perform strict validation to check if this is a bet game
      // Check multiple sources to ensure consistency
      const isBetGameFromUrl = new URLSearchParams(window.location.search).get('isBetGame') === 'true';
      const isBetGameFromStorage = localStorage.getItem('isBetGame') === 'true';
      const betTypeFromUrl = new URLSearchParams(window.location.search).get('betType');
      const betTypeFromStorage = localStorage.getItem('betType');
      
      // Log all bet-related values for debugging
      console.log('Bet game validation check:', {
        isBetGameFromUrl,
        isBetGameFromStorage,
        betTypeFromUrl,
        betTypeFromStorage,
        // Add any other relevant values
        gameId: gameRoomId,
        resultType: playerResult,
        reason: data.reason
      });
      
      // Call our onGameEnd callback if provided and this is a bet game with valid bet type
      if (onGameEnd) {
        const isWinner = playerResult === 'win';
        const isDraw = playerResult === 'draw';
        
        // Only call onGameEnd for confirmed bet games
        if (isBetGameFromUrl === true && isBetGameFromStorage === true && betTypeFromUrl && betTypeFromStorage) {
          console.log(`Calling onGameEnd for confirmed bet game with isWinner=${isWinner}, isDraw=${isDraw}`);
          onGameEnd(isWinner, isDraw);
        } else {
          console.log(`Not calling onGameEnd for regular game - strict validation failed`);
          
          // For regular games, ensure we clear any bet data
      safeLocalStorage.removeItem('isBetGame');
      safeLocalStorage.removeItem('betType');
      safeLocalStorage.removeItem('betId');
      safeLocalStorage.removeItem('opponentId');
        }
      }
      
      // Create game result data for the window event
      const gameEndedEvent = new CustomEvent('game_ended', {
        detail: resultData
      });
      
      // Dispatch the event to trigger the game result screen
      window.dispatchEvent(gameEndedEvent);
      
      console.log('Dispatched game_ended event with result data:', resultData);
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

  const stableBoardRef = useRef<BoardState | null>(null);
  
  // Handle move history updates from the ChessBoard component
  const handleMoveHistoryChange = useCallback((history: MoveHistoryState) => {
    // 🧠 IMPORTANT: This function is critical for maintaining a consistent move tracker display
    // When a player rewinds moves (using Back button) and then a new move is made:
    // 1. The ChessBoard component correctly maintains the move history state by trimming future moves 
    //    and appending the new move (see fixes in ChessBoard.tsx)
    // 2. We need to send ALL moves to the MoveTracker for display, not just the active ones
    // 3. This ensures the move tracker shows the complete history even after rewinds & new moves
    
    console.log(`Move history updated. Current index: ${history.currentMoveIndex}, Total moves: ${history.moves.length}`);
    
    // Save the current move history
    updateMoveHistory(history);
    
    // Determine if we're in review mode (viewing a historical move)
    const isReviewMode = history.currentMoveIndex !== history.moves.length - 1 && history.moves.length > 0;
    
    // Update the board state to match the currently viewed move
    if (history.currentMoveIndex >= 0 && history.currentMoveIndex < history.moves.length) {
      const currentMove = history.moves[history.currentMoveIndex];
      
      // Force a re-render by creating a new object reference
      updateBoardState({...currentMove.boardState});
      setLastMove({ from: currentMove.from, to: currentMove.to });
      
      // Store the current board state in a stable reference for comparison
      // This helps us detect when we need to override incoming socket updates
      stableBoardRef.current = {...currentMove.boardState};
      console.log("Updated stable board reference with current state:", getFen());
      
      if (isReviewMode) {
        console.log(`Showing historical move ${history.currentMoveIndex + 1}/${history.moves.length}`);
      } else {
        console.log(`Showing latest move ${history.currentMoveIndex + 1}/${history.moves.length}`);
      }
    } else if (history.currentMoveIndex === -1 && history.initialBoardState) {
      // If we're at the initial position (before any moves)
      // Force a re-render by creating a new object reference
      updateBoardState({...history.initialBoardState});
      setLastMove(null);
      
      // Store the initial board state in a stable reference
      stableBoardRef.current = {...history.initialBoardState};
      console.log("Updated stable board reference with initial state");
      
      console.log("Showing initial board position");
    }
  }, [getFen]);
  
  // Handle back button click
  const handleBackClick = useCallback(() => {
    goBack();
  }, [goBack]);
  
  // Handle forward button click
  const handleForwardClick = useCallback(() => {
    goForward();
  }, [goForward]);
  
  // Determine if we can go back/forward in the move history
  const canGoBack = moveHistory?.currentMoveIndex >= 0;
  const canGoForward = moveHistory?.currentMoveIndex < (moveHistory?.moves?.length || 0) - 1;
  
  // Debug values
  useEffect(() => {
    console.log('ChessBoardWrapper received playerColor:', playerColor);
    console.log('ChessBoardWrapper using timeControl:', gameState.timeControl);
    console.log('Calculated game time in seconds:', gameTimeInSeconds);
    console.log('Using gameId:', gameRoomId);
  }, [playerColor, gameState.timeControl, gameTimeInSeconds, gameRoomId]);
  
  // Handler for time out events
  const handleTimeOut = (player: 'white' | 'black') => {
    console.log(`${player} player ran out of time`);
    
    // Immediately stop both clocks
    setActivePlayer(null);
    
    // Update game state to mark it as over
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
    
    // Play time out sound
    if (soundEnabledRef.current) {
      playSound('GAME_END', true);
    }
    
    // Emit timeout event to the server using the correct event name 'report_timeout'
    if (socket) {
      // Convert 'white'/'black' to 'w'/'b' for the backend
      const color = player === 'white' ? 'w' : 'b';
      
      // Store which player timed out in localStorage
      safeLocalStorage.setItem(`timeout_player_${gameRoomId}`, player);
        console.log(`Stored timeout player ${player} in localStorage for game ${gameRoomId}`);
      
      console.log(`Emitting report_timeout event for ${player} (${color}) in game ${gameRoomId}`);
      
      // CRITICAL FIX: We need to determine if this client is reporting their own timeout or the opponent's
      const isReportingOwnTimeout = playerColor === player;
      console.log(`isReportingOwnTimeout: ${isReportingOwnTimeout}, playerColor: ${playerColor}, timedOutPlayer: ${player}`);
      
      // If this is the player who timed out, show loss screen
      if (isReportingOwnTimeout) {
        console.log(`This player (${playerColor}) timed out - showing loss screen`);
        
        // Create game result data for timeout - this player lost
    const timeoutResultData = {
          result: 'loss' as GameResultType,
      reason: 'timeout' as GameEndReason,
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerRatingChange: -10, // Loss for timing out
          opponentRatingChange: 10  // Win for opponent
    };
    
    // Set result data and show result screen
    setGameResultData(timeoutResultData);
    setShowResultScreen(true);
    
        // Emit the timeout event to the server with a flag indicating this player timed out
        socket.emit('report_timeout', {
          gameId: gameRoomId,
          color: color,
          reporterIsTimedOutPlayer: true
        });
        
        console.log(`Emitted report_timeout event with reporterIsTimedOutPlayer=true`);
      } else {
        // This client is reporting the opponent's timeout
        console.log(`Opponent (${player}) timed out - showing win screen`);
        
        // Create game result data for timeout - this player won
        const timeoutResultData = {
          result: 'win' as GameResultType,
      reason: 'timeout' as GameEndReason,
      playerName: playerColor === 'white' ? whitePlayer.username : blackPlayer.username,
      opponentName: playerColor === 'white' ? blackPlayer.username : whitePlayer.username,
      playerRating: playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating,
      opponentRating: playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating,
          playerRatingChange: 10, // Win because opponent timed out
          opponentRatingChange: -10  // Loss for opponent
        };
    
        // Set result data and show result screen
        setGameResultData(timeoutResultData);
    setShowResultScreen(true);
        
        // Emit the timeout event to the server with a flag indicating this player is reporting the opponent's timeout
        socket.emit('report_timeout', {
          gameId: gameRoomId,
          color: color,
          reporterIsTimedOutPlayer: false
        });
        
        console.log(`Emitted report_timeout event with reporterIsTimedOutPlayer=false`);
      }
    } else {
      console.error('Socket not available, cannot report timeout to server');
    }
  };

  // Handle draw offer responses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAcceptDraw = useCallback(() => {
    if (!socket) return;
    
    console.log('Accepting draw offer and notifying server');
    
    // Play button click sound using ref
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Accept');
    
    // Clear any draw offer timeout
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
    
    // Clear the draw offer UI
    setDrawOfferReceived(false);
    
    // Stop the clocks immediately
    setActivePlayer(null);
    
    // Notify the server about the draw acceptance
    // The server will broadcast a game_end event to both players
    // which will trigger the result screen for both players consistently
    socket.emit('draw_response', { 
      gameId: gameRoomId,
      accepted: true 
    });
    
    console.log('Sent draw_response with accepted=true to server');
    console.log('Waiting for server to broadcast game_end event');
    
    // We don't set game over state or show result screen here
    // Instead, we wait for the server's game_end event which will be handled by handleGameEnd
  }, [socket, gameRoomId, drawOfferTimeout, playSound]); // Remove soundEnabled dependency

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeclineDraw = useCallback(() => {
    if (!socket) return;
    
    console.log('Declining draw offer');
    
    // Clear the draw offer UI
    setDrawOfferReceived(false);
    
    // Play button click sound using ref
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Decline');
    
    // Clear any timeout
    if (drawOfferTimeout) {
      clearTimeout(drawOfferTimeout);
      setDrawOfferTimeout(null);
    }
    
    // Send decline response to server
    socket.emit('draw_response', { 
      gameId: gameRoomId,
      accepted: false 
    });
    
    console.log('Sent draw_response with accepted=false to server');
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
    
    console.log('Offering draw to opponent');
    socket.emit('draw_request', { gameId: gameRoomId });
    
    // Play button click sound
    playSound('BUTTON_CLICK', soundEnabledRef.current, 1.0, 'Draw Offer');
  }, [socket, gameRoomId, playSound]);

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
      // Check if this is a bet game
      const isBetGame = localStorage.getItem('isBetGame') === 'true';
      const betType = localStorage.getItem('betType');
      
      console.log(`[ChessBoardWrapper] Joining game room: ${gameRoomId}`, {
        isBetGame,
        betType,
        playerColor,
        timeControl
      });
      
      // First emit enter_game to get the initial game state
      socket.emit('enter_game', { 
        gameId: gameRoomId,
        isBetGame: isBetGame || false,
        betType: betType || null
      });
      
      // Then use the explicit join_game_room handler
      socket.emit('join_game_room', { 
        gameId: gameRoomId,
        isBetGame: isBetGame || false
      });

      // Listen for confirmation of joining the room
      const handleJoinedRoom = (data: { gameId: string, playerId: string }) => {
        console.log(`[ChessBoardWrapper] Successfully joined game room ${data.gameId} as player ${data.playerId}`);
        
        // If we haven't marked the game as ready yet, do so now
        if (!isGameReady && data.gameId === gameRoomId) {
          setIsGameReady(true);
          console.log('[ChessBoardWrapper] Game is now ready for moves (from joined_room):', gameRoomId);
        }
      };
      
      socket.on('joined_game_room', handleJoinedRoom);
      
      // Cleanup
      return () => {
        socket.off('joined_game_room', handleJoinedRoom);
      };
    }
  }, [socket, gameRoomId, playerColor, timeControl, isGameReady]);

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
        playerRating: playerColor === 'white' ? whitePlayer.rating || 1500 : blackPlayer.rating || 1500,
        opponentRating: playerColor === 'white' ? blackPlayer.rating || 1500 : whitePlayer.rating || 1500,
        playerPhotoURL: playerColor === 'white' ? whitePlayer.photoURL ?? null : blackPlayer.photoURL ?? null,
        opponentPhotoURL: playerColor === 'white' ? blackPlayer.photoURL ?? null : whitePlayer.photoURL ?? null,
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
  const { user, isGuest } = useAuth();

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
        playerName: (playerColor === 'white' ? whitePlayer.username : blackPlayer.username) || 'Player',
        opponentName: (playerColor === 'white' ? blackPlayer.username : whitePlayer.username) || 'Opponent',
        playerRating: typeof (playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating) === 'number' ? (playerColor === 'white' ? whitePlayer.rating : blackPlayer.rating) : 1500,
        opponentRating: typeof (playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating) === 'number' ? (playerColor === 'white' ? blackPlayer.rating : whitePlayer.rating) : 1500,
        playerPhotoURL: (playerColor === 'white' ? whitePlayer.photoURL : blackPlayer.photoURL) ?? null,
        opponentPhotoURL: (playerColor === 'white' ? blackPlayer.photoURL : whitePlayer.photoURL) ?? null,
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
      isBetGame,
      displayableResultData
    });

    // Timeout state for bet result
    let betResultTimeout: NodeJS.Timeout | null = null;

    if (!isGameActuallyOver) {
      setDisplayableResultData(null);
      return;
    }

    // If this is a bet game (detected by localBetResultForThisGame for this game)
    const isThisBetGame = !!(localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId);
    const isBetGameByFlag = isBetGame || isThisBetGame;

    if (isBetGameByFlag) {
      // For bet games, NEVER show the normal result screen
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
          betOpponentName: betOpponentName || '',
          opponentIdForBetContext: opponentIdForBetContext || '',
          playerName: finalGameResultData?.playerName || 'Player',
          opponentName: finalGameResultData?.opponentName || 'Opponent',
          playerRating: Number.isFinite(finalGameResultData?.playerRating) ? finalGameResultData.playerRating : 1500,
          opponentRating: Number.isFinite(finalGameResultData?.opponentRating) ? finalGameResultData.opponentRating : 1500,
          playerPhotoURL: finalGameResultData?.playerPhotoURL ?? null,
          opponentPhotoURL: finalGameResultData?.opponentPhotoURL ?? null,
        };
        setDisplayableResultData(betGameResultData);
        console.log('[BET DEBUG] Showing BET result screen:', betGameResultData);
      } else {
        // Bet result not ready, show spinner and set a timeout for error
        setDisplayableResultData(null);
        console.log('[BET DEBUG] Waiting for bet result...');
        if (!window.__betResultTimeoutSet) {
          window.__betResultTimeoutSet = true;
          betResultTimeout = setTimeout(() => {
            setDisplayableResultData({
              error: true,
              errorMessage: 'Bet result not received. Please check your connection or try refreshing the page.'
            });
            window.__betResultTimeoutSet = false;
          }, 10000); // 10 seconds
        }
      }
    } else {
      // Not a bet game, show standard result
      if (finalGameResultData) {
        setDisplayableResultData({
          ...finalGameResultData,
          isBetGame: false,
          playerRating: Number.isFinite(finalGameResultData?.playerRating) ? finalGameResultData.playerRating : 1500,
          opponentRating: Number.isFinite(finalGameResultData?.opponentRating) ? finalGameResultData.opponentRating : 1500,
          playerPhotoURL: finalGameResultData?.playerPhotoURL ?? null,
          opponentPhotoURL: finalGameResultData?.opponentPhotoURL ?? null,
        });
        console.log('[BET DEBUG] Showing STANDARD result screen:', finalGameResultData);
      } else {
        setDisplayableResultData(null);
      }
    }

    // Cleanup timeout on effect cleanup
    return () => {
      if (betResultTimeout) clearTimeout(betResultTimeout);
      window.__betResultTimeoutSet = false;
    };
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
    updateBoardState(getCurrentBoardState());
    setSanMoveList(chess.history());
  }, [gameRoomId]);

  // Listen for add_move_to_queue events from the useChessMultiplayer hook
  useEffect(() => {
    // Define the handler for the add_move_to_queue event
    const handleAddMoveToQueue = (event: CustomEvent) => {
      const moveData = event.detail;
      console.log('[EVENT] Received add_move_to_queue event:', moveData);
      
      // Validate that the move has all required fields
      if (!moveData.from || !moveData.to || !moveData.player) {
        console.error('[ERROR] Invalid move data received:', moveData);
        return;
      }
      
      // Add the move to the moveQueue
      setMoveQueue(prev => [...prev, {
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion,
        player: moveData.player,
        notation: moveData.notation,
        isCapture: moveData.isCapture
      }]);
    };
    
    // Add the event listener
    window.addEventListener('add_move_to_queue', handleAddMoveToQueue as EventListener);
    
    // Clean up when component unmounts
    return () => {
      window.removeEventListener('add_move_to_queue', handleAddMoveToQueue as EventListener);
    };
  }, []);

  // Add a useEffect to update hasWhiteMoved whenever moveHistory changes (around line 350)
  // Update hasWhiteMoved based on moveHistory
  useEffect(() => {
    if (moveHistory && moveHistory.moves && moveHistory.moves.length > 0) {
      // If there are moves in the history, white must have moved
      setGameState(prevState => ({
        ...prevState,
        hasWhiteMoved: true
      }));
      console.log('Setting hasWhiteMoved to true based on moveHistory:', moveHistory.moves.length);
    }
  }, [moveHistory]);

  // Add debug logs to the game_state handler
  useEffect(() => {
    if (!socket || !gameRoomId) return;

    const handleGameState = (data: any) => {
      console.log(`[ChessBoardWrapper] Received game_state for ${gameRoomId}:`, data);
      
      // Debug players data specifically for bet games
      if (data.players) {
        console.log(`[ChessBoardWrapper] White player: ${data.players.white.username} (${data.players.white.rating})`, 
                    data.players.white);
        console.log(`[ChessBoardWrapper] Black player: ${data.players.black.username} (${data.players.black.rating})`, 
                    data.players.black);
        
        // Add extra logs for bet games
        if (data.isBetGame) {
          console.log(`[ChessBoardWrapper] This is a bet game (${data.betType})`);
        }
      }
      
      // Mark the game as ready to accept moves
      if (data && data.gameId === gameRoomId) {
        setIsGameReady(true);
        console.log('[ChessBoardWrapper] Game is now ready for moves:', gameRoomId);
      }
      
      // Rest of your handler logic
      setGameState(data);
    };

    socket.on('game_state', handleGameState);

    return () => {
      socket.off('game_state', handleGameState);
    };
  }, [socket, gameRoomId]);

  // Add debug logs to the board_updated handler
  useEffect(() => {
    if (!socket || !gameRoomId) return;

    const handleBoardUpdated = (data: any) => {
      if (data.gameId !== gameRoomId) return;
      
      console.log(`[ChessBoardWrapper] Received board_updated for ${gameRoomId}:`, {
        fen: data.fen,
        moveCount: data.moveHistory?.length,
        whiteTurn: data.whiteTurn
      });
      
      // Rest of your handler logic
      // ...
    };

    socket.on('board_updated', handleBoardUpdated);

    return () => {
      socket.off('board_updated', handleBoardUpdated);
    };
  }, [socket, gameRoomId]);

  // Add debug logs to the move_made handler
  useEffect(() => {
    if (!socket || !gameRoomId) return;

    const handleMoveMade = (data: any) => {
      if (data.gameId !== gameRoomId) return;
      
      console.log(`[ChessBoardWrapper] Received move_made for ${gameRoomId}:`, {
        from: data.from,
        to: data.to,
        san: data.san,
        fen: data.fen
      });
      
      // Rest of your handler logic
      // ...
    };

    socket.on('move_made', handleMoveMade);

    return () => {
      socket.off('move_made', handleMoveMade);
    };
  }, [socket, gameRoomId]);

  // Helper function to determine which bet result component to show
  const renderBetResultComponent = () => {
    if (!displayableResultData) return null;

    // Process data to ensure all required fields have proper values
    const processedData = processResultData(displayableResultData);
    
    // Get common props with proper types
    const commonProps = {
      ...getBetResultComponentProps(processedData)
      // onRematch: handleRematch // Removed as requested
    };

    // Determine which component to render based on bet type
    switch (processedData.betType) {
      case 'profile_control':
        return <ProfileControlResult {...commonProps} />;
      case 'profile_lock':
        return <ProfileLockResult {...commonProps} />;
      case 'rating_stake':
        return <RatingStakeResult 
          {...commonProps} 
          stakeAmount={Math.abs(processedData.playerRatingChange)} 
        />;
      default:
        // Fallback for standard games
        return <GameResultScreen {...processedData} />;
    }
  };

  // In the render function
  if (showResultScreen) {
    if (isBetGame && displayableResultData) {
      return renderBetResultComponent();
    } else if (displayableResultData) {
      // Process regular game data to ensure proper types
      const processedData = processResultData(displayableResultData);
      return <GameResultScreen {...processedData} />;
    } else {
      // Show loading spinner while waiting for result data
      return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="w-10 h-10 border-t-2 border-white rounded-full animate-spin mx-auto mb-4"></div>
            <p>Loading result...</p>
          </div>
        </div>
      );
    }
  }

  // Move handleRematch above renderBetResultComponent
  const handleRematch = () => {
    alert('Rematch feature coming soon!');
  };
  // Add a direct reference to the current board state for move navigation
  // const stableBoardRef = useRef<BoardState | null>(null);

  


  return (
    <div className="flex flex-col w-full h-full rounded-t-xl rounded-b-none sm:rounded-t-xl sm:rounded-b-none overflow-hidden flex-shrink-0 pb-[62px]" style={{ backgroundColor: '#4A7C59' }}>
      {/* Bet Result Loading Spinner */}
      {isGameActuallyOver && (isBetGame || (localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId)) && !(localBetResultForThisGame && localBetResultForThisGame.gameId === gameRoomId) && !displayableResultData?.error && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-[#4A7C59] border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-[#F9F3DD] text-sm">Waiting for bet result...</p>
        </div>
      )}
      {/* Bet Result Error */}
      {displayableResultData?.error && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-red-400 text-sm">{displayableResultData.errorMessage}</p>
        </div>
      )}
      {/* Game Result Screen */}
      {displayableResultData && !displayableResultData.error && (
        (() => {
          console.log('[BET DEBUG] Rendering GameResultScreen with props:', displayableResultData);
          if (isBetGame) {
            return renderBetResultComponent();
          } else {
          // Use guest displayName for playerName/opponentName if guest
          const playerName = isGuest && user && user.displayName ? user.displayName : displayableResultData.playerName;
          const opponentName = isGuest && user && user.displayName && displayableResultData.opponentName === 'Black Player' ? user.displayName : displayableResultData.opponentName;
          return (
            <GameResultScreen
              result={displayableResultData.result}
              reason={displayableResultData.reason}
              gameId={gameRoomId}
              playerName={playerName}
              opponentName={opponentName}
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
          }
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
              username={isGuest && user && user.displayName ? user.displayName : whitePlayer.username}
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
                timeInSeconds={whiteTimeRemaining}
                isActive={activePlayer === 'white'}
                isDarkTheme={false}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabled)}
                onTimeUpdate={handleWhiteTimeUpdate}
              />
        </div>
      </div>
      
      {/* Chess Board */}
      <ChessBoard 
            perspective={playerColor || 'white'}
        onMoveHistoryChange={handleMoveHistoryChange}
            playerColor={playerColor}
            gameId={gameRoomId}
            boardState={isViewingHistory ? boardState : getCurrentBoardState()}
      />
      
          {/* Player 2 Info (Bottom) - Black */}
          <div className="flex justify-between items-center mt-4 sm:mt-2 mx-[21px]">
        <PlayerInfo 
          position="bottom"
          username={isGuest && user && user.displayName ? user.displayName : blackPlayer.username}
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
                timeInSeconds={blackTimeRemaining}
                isActive={activePlayer === 'black'}
                isDarkTheme={true}
                onTimeOut={() => handleTimeOut('black')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
                onTimeUpdate={handleBlackTimeUpdate}
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
              username={isGuest && user && user.displayName ? user.displayName : blackPlayer.username}
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
                timeInSeconds={blackTimeRemaining}
                isActive={activePlayer === 'black'}
                isDarkTheme={false}
                onTimeOut={() => handleTimeOut('black')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
                onTimeUpdate={handleBlackTimeUpdate}
              />
            </div>
          </div>
          
          {/* Chess Board */}
          <ChessBoard 
            perspective={playerColor || 'white'}
            onMoveHistoryChange={handleMoveHistoryChange}
            playerColor={playerColor}
            gameId={gameRoomId}
            boardState={isViewingHistory ? boardState : getCurrentBoardState()}
          />
          
          {/* Player 1 Info (Bottom) - White */}
          <div className="flex justify-between items-center mt-4 sm:mt-2 mx-[21px]">
            <PlayerInfo 
              position="bottom"
              username={isGuest && user && user.displayName ? user.displayName : whitePlayer.username}
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
                timeInSeconds={whiteTimeRemaining}
            isActive={activePlayer === 'white'}
            isDarkTheme={true}
                onTimeOut={() => handleTimeOut('white')}
                playLowTimeSound={() => playSound('TIME_LOW', soundEnabledRef.current)}
                onTimeUpdate={handleWhiteTimeUpdate}
          />
        </div>
      </div>
        </>
      )}
      
      {/* Debug logging moved to useEffect */}
      
      {/* Move Controls */}
      <div className="move-controls-container relative">
      <MoveControls
        onBack={handleBackClick}
        onForward={handleForwardClick}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        gameId={gameRoomId}
        gameState={gameState}
        onResign={handleResignGame}
        onAbortGame={handleAbortGame}
          moveHistory={{
            length: moveHistory?.moves?.length || 0,
            currentMoveIndex: moveHistory?.currentMoveIndex || -1
          }}
        whitePlayer={whitePlayer}
        blackPlayer={blackPlayer}
        playerColor={playerColor}
      />
        
        {/* Live button to exit history mode */}
        {isViewingHistory && (
          <button 
            onClick={() => {
              // Prevent multiple clicks
              if ((window as any).isExitingHistoryMode) {
                console.log("[ChessBoardWrapper] Already exiting history mode, ignoring click");
                return;
              }
              
              // Set a flag to prevent multiple clicks
              (window as any).isExitingHistoryMode = true;
              
              // Get current live board state from chess engine
              const currentLiveBoardState = getCurrentBoardState();
              exitHistoryMode(currentLiveBoardState);
              
              // Clear the flag after a short delay
              setTimeout(() => {
                (window as any).isExitingHistoryMode = false;
              }, 500);
            }}
            className="absolute right-2 top-0 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
            aria-label="Return to live game"
          >
            Live
          </button>
        )}
      </div>
      
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
});

export default ChessBoardWrapper; 