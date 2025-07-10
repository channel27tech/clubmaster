import { useEffect, useRef, useState, useCallback } from 'react';
import { BoardState } from '../utils/moveHistory';
import { 
  getFen, 
  setChessPosition, 
  resetChessEngine, 
  getCurrentBoardState,
  getChessEngine
} from '../utils/chessEngine';

/**
 * Helper function to fully synchronize the board state from FEN
 */
export const synchronizeBoardFromFen = (fen: string): BoardState => {
  try {
    // Reset the chess engine with the provided FEN
    resetChessEngine();
    const chess = getChessEngine();
    
    // Load the FEN into the chess engine
    const success = chess.load(fen);
    
    if (!success) {
      console.error('Failed to load FEN:', fen);
      return getCurrentBoardState(); // Return current state as fallback
    }
    
    // If we got here without an error, the load was successful
    return getCurrentBoardState();
  } catch (error) {
    console.error('Error synchronizing board from FEN:', error);
    return getCurrentBoardState(); // Return current state as fallback
  }
};

interface UseBoardSyncProps {
  boardState: BoardState;
  gameId?: string;
  socketService?: any; // Socket service for requesting server sync
  intervalMs?: number;
  maxRetries?: number;
}

interface UseBoardSyncResult {
  currentFen: string | null;
  checkConsistency: () => boolean;
  recoverBoardState: () => boolean;
  requestServerSync: () => void;
  syncStatus: 'synced' | 'syncing' | 'error';
  lastSyncTime: number | null;
}

/**
 * Custom hook to maintain board state consistency
 */
const useBoardSync = ({
  boardState,
  gameId,
  socketService,
  intervalMs = 100,
  maxRetries = 3
}: UseBoardSyncProps): UseBoardSyncResult => {
  // Add a stable reference to the current board state
  const boardStateRef = useRef<{
    fen: string | null;
    boardState: BoardState | null;
    checksum: string | null;
  }>({
    fen: null,
    boardState: null,
    checksum: null
  });

  // Track sync status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const retryCountRef = useRef<number>(0);
  
  // Generate a checksum from the board state for quick comparison
  const generateChecksum = useCallback((state: BoardState): string => {
    try {
      // Create a simplified representation of the board for checksum
      const simplifiedBoard = state.squares.map(row => 
        row.map(square => square.piece ? `${square.piece.type}-${square.piece.color}` : 'empty')
      );
      return JSON.stringify(simplifiedBoard);
    } catch (error) {
      console.error('Error generating board checksum:', error);
      return '';
    }
  }, []);
  
  // Update our stable reference whenever the board state changes
  useEffect(() => {
    if (boardState) {
      const currentFen = getFen();
      const checksum = generateChecksum(boardState);
      
      boardStateRef.current = {
        fen: currentFen,
        boardState: boardState,
        checksum: checksum
      };
      
      // Reset retry counter when board state updates successfully
      retryCountRef.current = 0;
      
      // Update sync status
      setSyncStatus('synced');
      setLastSyncTime(Date.now());
    }
  }, [boardState, generateChecksum]);
  
  // Request a sync from the server
  const requestServerSync = useCallback(() => {
    if (!socketService || !gameId) {
      console.warn('Cannot request server sync: missing socketService or gameId');
      return;
    }
    
    try {
      console.log(`Requesting board sync from server for game ${gameId}`);
      setSyncStatus('syncing');
      
      socketService.emit('request_board_sync', {
        gameId: gameId,
        reason: 'client_requested_sync',
        clientState: getFen()
      });
    } catch (error) {
      console.error('Error requesting server sync:', error);
      setSyncStatus('error');
    }
  }, [socketService, gameId]);
  
  // Add a recovery mechanism that runs periodically to ensure board state consistency
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Only check if we have a valid reference
      if (boardStateRef.current.fen) {
        const currentFen = getFen();
        const currentBoardState = getCurrentBoardState();
        const currentChecksum = generateChecksum(currentBoardState);
        
        // Check if board state has changed unexpectedly
        if (currentFen !== boardStateRef.current.fen && 
            currentChecksum !== boardStateRef.current.checksum &&
            boardState === boardStateRef.current.boardState) {
          
          console.warn('Board state inconsistency detected');
          
          // Try to recover locally first
          const recoverySuccess = setChessPosition(boardStateRef.current.fen);
          
          if (!recoverySuccess) {
            retryCountRef.current++;
            console.warn(`Local recovery failed, retry count: ${retryCountRef.current}`);
            
            // If we've tried too many times locally, request server sync
            if (retryCountRef.current >= maxRetries && socketService && gameId) {
              console.warn('Max local retries reached, requesting server sync');
              requestServerSync();
            }
          } else {
            console.log('Successfully recovered board state locally');
            retryCountRef.current = 0;
            setSyncStatus('synced');
            setLastSyncTime(Date.now());
          }
        }
      }
    }, intervalMs);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [boardState, generateChecksum, intervalMs, maxRetries, requestServerSync, socketService, gameId]);
  
  // Add another effect for periodic server sync (less frequent)
  useEffect(() => {
    // Only set up if we have socket service and game ID
    if (!socketService || !gameId) return;
    
    const periodicServerSync = () => {
      // Only request sync if we haven't synced recently (last 30 seconds)
      const timeSinceLastSync = lastSyncTime ? Date.now() - lastSyncTime : Infinity;
      if (timeSinceLastSync > 30000) {
        requestServerSync();
      }
    };
    
    // Check for server sync every 30 seconds
    const intervalId = setInterval(periodicServerSync, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [socketService, gameId, lastSyncTime, requestServerSync]);
  
  // Check if the board is consistent with our reference
  const checkConsistency = useCallback(() => {
    if (!boardStateRef.current.fen) return true; // No reference to compare against
    
    const currentFen = getFen();
    return currentFen === boardStateRef.current.fen;
  }, []);
  
  // Recover the board state from our reference
  const recoverBoardState = useCallback(() => {
    if (boardStateRef.current.fen) {
      const success = setChessPosition(boardStateRef.current.fen);
      
      if (success) {
        setSyncStatus('synced');
        setLastSyncTime(Date.now());
      } else {
        setSyncStatus('error');
      }
      
      return success;
    }
    return false;
  }, []);
  
  return {
    currentFen: boardStateRef.current.fen,
    checkConsistency,
    recoverBoardState,
    requestServerSync,
    syncStatus,
    lastSyncTime
  };
};

export default useBoardSync; 