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
  onPlayerTurnChange
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
    
    const movePayload = {
      from,
      to,
      player: piece.color,
      notation,
      isCapture,
      promotion,
      fen: currentFen,
      gameId: gameId || socket.id
    };
    
    console.log('[ChessMultiplayer] Emitting move_made:', JSON.stringify(movePayload));
    socket.emit('move_made', movePayload);
  }, [socket, playerColor, boardState, gameId]);

  // Request board synchronization from server
  const requestSync = useCallback((reason: string) => {
    if (!socket || !gameId) return;
    
    socket.emit('request_board_sync', { 
      gameId,
      reason,
      clientState: getFen()
    });
  }, [socket, gameId]);
  
  // Listen for opponent moves
  useEffect(() => {
    if (!socket) return;

    // Handle board sync from server
    const handleBoardSync = (data: { fen: string, gameId: string }) => {
      console.log('Received board sync:', data);
      try {
        // Synchronize the board state from the FEN
        const newBoardState = synchronizeBoardFromFen(data.fen);
        
        // Update the board state
        onBoardStateUpdate(newBoardState);
        console.log('Board synchronized successfully with FEN:', data.fen);
        
        // Create a new move history based on this state
        const newHistory = {
          ...moveHistory,
          moves: moveHistory.moves,
          currentMoveIndex: moveHistory.moves.length - 1,
          initialBoardState: newBoardState,
        };
        
        // Update the move history
        onMoveHistoryUpdate(newHistory);
      } catch (error) {
        console.error('Failed to synchronize board state:', error);
      }
    };

    // Handle receiving moves from opponent
    const handleOpponentMove = (data: { 
      from: string, 
      to: string, 
      player: string, 
      notation: string,
      gameId: string,
      promotion?: PieceType,
      isCapture?: boolean,
      fen?: string,
      pgn?: string
    }) => {
      console.log('Received move from opponent:', data);
      
      // Only process opponent's moves
      if (playerColor && data.player !== playerColor) {
        console.log(`Processing opponent move. Our color: ${playerColor}, move made by: ${data.player}`);
        
        // Try FEN synchronization first if available
        if (data.fen) {
          try {
            console.log('Using provided FEN for synchronization:', data.fen);
            
            // Synchronize using FEN
            const newBoardState = synchronizeBoardFromFen(data.fen);
            
            // Extract piece information from the move
            const movingPiece = extractPieceInfoFromNotation(data.notation, data.player as PieceColor);
            
            if (movingPiece) {
              // Check if we're in a rewound state
              const isRewound = moveHistory.currentMoveIndex < moveHistory.moves.length - 1;
              
              // Create a new array for the updated move history without truncating
              const updatedMoves = [...moveHistory.moves];
              
              // Create the new move to append
              const newMove = {
                from: data.from,
                to: data.to,
                piece: movingPiece,
                notation: data.notation,
                promotion: data.promotion,
                boardState: newBoardState
              };
              
              // Check if this exact move already exists at the end of our history
              const lastMove = updatedMoves.length > 0 ? updatedMoves[updatedMoves.length - 1] : null;
              if (!lastMove || lastMove.notation !== data.notation) {
                updatedMoves.push(newMove);
              }
              
              // Create the new history object
              const newHistory = {
                ...moveHistory,
                moves: updatedMoves,
                currentMoveIndex: updatedMoves.length - 1
              };
              
              // Update all the state through callbacks
              onMoveHistoryUpdate(newHistory);
              onBoardStateUpdate(newBoardState);
              onLastMoveUpdate({ from: data.from, to: data.to });
              onPlayerTurnChange(data.player === 'white' ? 'black' : 'white');
              
              console.log('Successfully synchronized with FEN');
              return; // Success! Exit early
            }
          } catch (error) {
            console.error('Error synchronizing from FEN:', error);
            // Continue to fallback methods
            requestSync('fen_sync_failed');
          }
        } else {
          // No FEN provided, request sync
          requestSync('no_fen_provided');
        }
      }
    };

    // Register socket event handlers
    socket.on('move_made', handleOpponentMove);
    socket.on('board_sync', handleBoardSync);

    // Cleanup on unmount
    return () => {
      socket.off('move_made', handleOpponentMove);
      socket.off('board_sync', handleBoardSync);
    };
  }, [
    socket, 
    playerColor, 
    gameId, 
    boardState, 
    moveHistory, 
    onBoardStateUpdate,
    onMoveHistoryUpdate,
    onLastMoveUpdate,
    onPlayerTurnChange,
    requestSync
  ]);

  return {
    sendMove,
    requestSync
  };
};

export default useChessMultiplayer; 