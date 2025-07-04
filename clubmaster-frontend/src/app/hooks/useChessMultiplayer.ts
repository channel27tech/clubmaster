import { useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { MoveHistoryState, BoardState, PieceType, PieceColor } from '../utils/moveHistory';
import { getFen } from '../utils/chessEngine';
import { extractPieceInfoFromNotation, findMovingPiece } from '../utils/boardHelpers';
import { synchronizeBoardFromFen } from './useBoardSync';

interface UseChessMultiplayerProps {
  gameId?: string;
  playerColor?: 'white' | 'black' | null;
  boardState: BoardState;
  moveHistory: MoveHistoryState;
  onBoardStateUpdate: (boardState: BoardState) => void;
  onMoveHistoryUpdate: (moveHistory: MoveHistoryState) => void;
  onLastMoveUpdate: (move: { from: string, to: string } | null) => void;
  onPlayerTurnChange: (color: 'white' | 'black') => void;
  isInReviewMode?: boolean;
}

interface UseChessMultiplayerResult {
  // Actions
  sendMove: (from: string, to: string, piece: { type: PieceType, color: PieceColor }, notation: string, promotion?: PieceType) => void;
  requestSync: (reason: string) => void;
}

/**
 * Custom hook for multiplayer chess functionality via sockets
 */
export const useChessMultiplayer = ({
  gameId,
  playerColor,
  boardState,
  moveHistory,
  onBoardStateUpdate,
  onMoveHistoryUpdate,
  onLastMoveUpdate,
  onPlayerTurnChange,
  isInReviewMode
}: UseChessMultiplayerProps): UseChessMultiplayerResult => {
  const { socket } = useSocket();
  
  // Send a move to other players
  const sendMove = useCallback((
    from: string,
    to: string,
    piece: { type: PieceType, color: PieceColor },
    notation: string,
    promotion?: PieceType
  ) => {
    if (!socket || !playerColor || piece.color !== playerColor) return;
    
    // Check if destination contains a piece (it's a capture)
    let isCapture = false;
    const toRowIndex = 8 - parseInt(to[1], 10);
    const toColIndex = to.charCodeAt(0) - 'a'.charCodeAt(0);
    if (boardState.squares[toRowIndex] && 
        boardState.squares[toRowIndex][toColIndex] && 
        boardState.squares[toRowIndex][toColIndex].piece) {
      isCapture = true;
    }
    
    // Get current FEN for synchronization
    const currentFen = getFen();
    
    // Instead of emitting directly, dispatch an event to add this move to the moveQueue
    // This ensures all moves go through a single path
    console.log('[ChessMultiplayer] Adding move to queue:', { from, to, player: piece.color, promotion });
    
    // Create a custom event to add the move to the queue
    const moveEvent = new CustomEvent('add_move_to_queue', {
      detail: {
      from,
      to,
      player: piece.color,
      notation,
      isCapture,
      promotion,
      fen: currentFen,
      gameId: gameId || socket.id
      }
    });
    
    // Dispatch the event to be handled by ChessBoardWrapper
    window.dispatchEvent(moveEvent);
    
    // Immediately update the player turn locally to prevent UI lag
    // The server will confirm this later
    onPlayerTurnChange(piece.color === 'white' ? 'black' : 'white');
  }, [socket, playerColor, boardState, gameId, onPlayerTurnChange]);

  // Request board synchronization from server
  const requestSync = useCallback((reason: string) => {
    if (!socket || !gameId) return;
    
    socket.emit('request_board_sync', { 
      gameId,
      reason,
      clientState: getFen()
    });
  }, [socket, gameId]);
  
  // Handle receiving moves from server (process all moves, not just opponent's)
  const handleMoveFromServer = useCallback((data: { 
    from: string, 
    to: string, 
    player: string, 
    notation?: string,
    san?: string,
    gameId: string,
    promotion?: PieceType,
    isCapture?: boolean,
    fen?: string,
    pgn?: string
  }) => {
    console.log('[SERVER] Received move from server:', data);
    
    // Don't add server-broadcast moves to the moveQueue
    // Instead, directly apply them to our local board state
    
    // Process the move regardless of who made it
    if (data.fen) {
      try {
        console.log('[SYNC] Using provided FEN for synchronization:', data.fen);
        
        // Synchronize using FEN
        const newBoardState = synchronizeBoardFromFen(data.fen);
        
        // Extract piece information from the move (try san first, then notation)
        const movingPiece = extractPieceInfoFromNotation(data.san || data.notation, data.player as PieceColor);
        
        // Create a new array for the updated move history
        const updatedMoves = [...moveHistory.moves];
        
        // Create the new move to append
        const newMove = {
          from: data.from,
          to: data.to,
          piece: movingPiece || { type: 'pawn', color: data.player as PieceColor }, // Default to pawn if extraction fails
          notation: data.san || data.notation || `${data.from}-${data.to}`, // Fallback notation
          promotion: data.promotion,
          boardState: newBoardState
        };
        
        // Check if this exact move already exists at the end of our history
        const lastMove = updatedMoves.length > 0 ? updatedMoves[updatedMoves.length - 1] : null;
        if (!lastMove || lastMove.notation !== newMove.notation) {
          updatedMoves.push(newMove);
        }
        
        // Create the new history object
        const newHistory = {
          ...moveHistory,
          moves: updatedMoves,
          currentMoveIndex: updatedMoves.length - 1
        };
        
        // Determine the next player's turn based on who just moved
        const nextPlayerTurn = data.player === 'white' ? 'black' : 'white';
        
        // Always update the move history to include the new move
        onMoveHistoryUpdate(newHistory);
        
        // Only update the visible board state if we're not in review mode
        if (!isInReviewMode) {
          console.log('Not in review mode, updating visible board state');
          onBoardStateUpdate(newBoardState);
          onLastMoveUpdate({ from: data.from, to: data.to });
        } else {
          console.log('In review mode, preserving historical view (not updating visible board state)');
        }
        
        // CRITICAL: Always update the player turn after a move
        console.log(`[TURN] Setting active player to ${nextPlayerTurn} after move from ${data.player}`);
        onPlayerTurnChange(nextPlayerTurn);
        
        console.log('[SYNC] Successfully synchronized with FEN');
      } catch (error) {
        console.error('[ERROR] Error synchronizing from FEN:', error);
        requestSync('fen_sync_failed');
      }
    } else {
      console.warn('[WARN] No FEN provided in move_made event');
      requestSync('no_fen_provided');
    }
  }, [moveHistory, onBoardStateUpdate, onMoveHistoryUpdate, onLastMoveUpdate, onPlayerTurnChange, requestSync, isInReviewMode]);

    // Handle board sync from server
  const handleBoardSync = useCallback((data: { 
    fen: string, 
    gameId: string,
    whiteTurn?: boolean 
  }) => {
    if (data.gameId !== gameId) return;
    
    console.log('Received board sync:', data);
    try {
      // Synchronize the board state from the FEN
      const newBoardState = synchronizeBoardFromFen(data.fen);
      
      // Check if the board state has actually changed to prevent unnecessary updates
      const isBoardStateChanged = JSON.stringify(newBoardState) !== JSON.stringify(boardState);
      
      if (isBoardStateChanged) {
        // Only update the visible board state if we're not in review mode
        if (!isInReviewMode) {
          // Update the board state only if it has changed
          console.log('Not in review mode, updating visible board state');
          onBoardStateUpdate(newBoardState);
          console.log('Board synchronized successfully with FEN:', data.fen);
        } else {
          console.log('In review mode, preserving historical view (not updating visible board state)');
        }
        
        // Always update the underlying move history
        // This ensures that when the user exits review mode, they'll see the latest state
        const newHistory = {
          ...moveHistory,
          moves: moveHistory.moves,
          currentMoveIndex: moveHistory.moves.length - 1,
          initialBoardState: newBoardState,
        };
        
        // Update the move history
        onMoveHistoryUpdate(newHistory);
        
        // Update player turn if provided
        if (data.whiteTurn !== undefined) {
          const activePlayer = data.whiteTurn ? 'white' : 'black';
          console.log(`[TURN] Setting active player to ${activePlayer} from board sync`);
          onPlayerTurnChange(activePlayer);
        }
      } else {
        console.log('Board state unchanged, skipping update');
      }
    } catch (error) {
      console.error('Failed to synchronize board state:', error);
    }
  }, [gameId, moveHistory, boardState, onBoardStateUpdate, onMoveHistoryUpdate, onPlayerTurnChange, isInReviewMode]);

  // Handle board updates from server
  const handleBoardUpdate = useCallback((data: {
    gameId: string;
    fen: string;
    pgn: string;
    moveHistory: string[];
    lastMove: string;
    whiteTurn: boolean;
    isCapture: boolean;
    isCheck: boolean;
    moveCount: number;
    isGameOver: boolean;
    timestamp: number;
    }) => {
    if (data.gameId !== gameId) return;
    
    console.log(`Received board_updated event for game ${data.gameId}, whiteTurn=${data.whiteTurn}`);
    
    try {
      // CRITICAL: Always update the active player first based on whiteTurn
      // This ensures clocks and turn indicators stay in sync
      const activePlayer = data.whiteTurn ? 'white' : 'black';
      console.log(`[TURN] Setting active player to ${activePlayer} from board update`);
      onPlayerTurnChange(activePlayer);
            
      // Synchronize the board using the provided FEN
      const newBoardState = synchronizeBoardFromFen(data.fen);
            
      // Check if the board state has actually changed to prevent unnecessary updates
      const isBoardStateChanged = JSON.stringify(newBoardState) !== JSON.stringify(boardState);
      
      if (isBoardStateChanged) {
        // Extract last move information
        const lastMove = data.lastMove ? {
          from: data.lastMove.substring(0, 2),
          to: data.lastMove.substring(2, 4)
        } : null;
              
        // Only update the visible board state if we're not in review mode
        if (!isInReviewMode) {
          console.log('Not in review mode, updating visible board state');
          // Update all the state through callbacks
          onBoardStateUpdate(newBoardState);
          if (lastMove) onLastMoveUpdate(lastMove);
          
          console.log('Successfully processed board update');
        } else {
          console.log('In review mode, preserving historical view (not updating visible board state)');
        }
      } else {
        console.log('Board state unchanged, skipping board state update');
      }
    } catch (error) {
      console.error('Error processing board update:', error);
      requestSync('board_update_failed');
    }
  }, [gameId, boardState, onBoardStateUpdate, onLastMoveUpdate, onPlayerTurnChange, requestSync, isInReviewMode]);
  
  // Register socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Register socket event handlers
    socket.on('move_made', handleMoveFromServer);
    socket.on('board_sync', handleBoardSync);
    socket.on('board_updated', handleBoardUpdate);
    
    // Request initial board sync when connecting
    if (gameId) {
      console.log('[INIT] Requesting initial board sync for game:', gameId);
      requestSync('initial_connection');
    }

    // Clean up event listeners on unmount
    return () => {
      socket.off('move_made', handleMoveFromServer);
      socket.off('board_sync', handleBoardSync);
      socket.off('board_updated', handleBoardUpdate);
    };
  }, [socket, gameId, handleMoveFromServer, handleBoardSync, handleBoardUpdate, requestSync]);

  return {
    sendMove,
    requestSync
  };
};

export default useChessMultiplayer; 