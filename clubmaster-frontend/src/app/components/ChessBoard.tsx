'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ChessPiece from './ChessPiece';
import PromotionSelector from './PromotionSelector';
import { BoardState, BoardSquare, initializeMoveHistory, MoveHistoryState, goBackOneMove, goForwardOneMove, addMove, generateNotation, PieceType, PieceColor } from '../utils/moveHistory';
import { getChessEngine, resetChessEngine, isLegalMove, makeMove, getGameStatus, getCurrentBoardState, setChessPosition, getFen } from '../utils/chessEngine';
import { useSocket } from '../../contexts/SocketContext';

// Helper function to fully synchronize the board state from FEN
const synchronizeBoardFromFen = (fen: string): BoardState => {
  try {
    // Reset the chess engine with the provided FEN
    resetChessEngine();
    const chess = getChessEngine();
    
    // Load the FEN into the chess engine
    const loadSuccess = chess.load(fen);
    
    if (!loadSuccess) {
      console.error('Failed to load FEN:', fen);
      return getCurrentBoardState(); // Return current state as fallback
    }
    
    // Get the new board state after successfully loading the FEN
    return getCurrentBoardState();
  } catch (error) {
    console.error('Error synchronizing board from FEN:', error);
    return getCurrentBoardState(); // Return current state as fallback
  }
};

interface ChessBoardProps {
  perspective?: 'white' | 'black';
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
  playerColor?: 'white' | 'black' | null;
  gameId?: string; // ID of the current game for socket communications
}

const ChessBoard = ({ perspective = 'white', onMoveHistoryChange, playerColor, gameId }: ChessBoardProps) => {
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState>(() => initializeMoveHistory());
  const [boardState, setBoardState] = useState<BoardState>(moveHistory.initialBoardState);
  const [lastMove, setLastMove] = useState<{ from: string, to: string } | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  
  // Promotion state
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{
    from: string;
    to: string;
    piece: { type: PieceType, color: PieceColor };
    position: { x: number, y: number };
  } | null>(null);

  // Reference to the board element for positioning the promotion selector
  const boardRef = useRef<HTMLDivElement>(null);
  
  // Get socket for remote move updates
  const { socket } = useSocket();
  
  // Helper to find a piece on the board
  const findMovingPiece = useCallback((position: string, boardState: BoardState): { type: PieceType, color: PieceColor } | null => {
    for (const row of boardState.squares) {
      for (const square of row) {
        if (square.position === position && square.piece) {
          return { ...square.piece };
        }
      }
    }
    return null;
  }, []);

  // Helper to extract piece info from algebraic notation
  const extractPieceInfoFromNotation = useCallback((notation: string, playerColor: PieceColor): { type: PieceType, color: PieceColor } | null => {
    if (!notation) return null;
    
    try {
      // For pawn moves (no piece letter at start)
      if (!notation.match(/^[KQRBN]/)) {
        return {
          type: 'pawn',
          color: playerColor
        };
      }
      
      // For other pieces
      const pieceChar = notation[0];
      const pieceType = 
        pieceChar === 'K' ? 'king' :
        pieceChar === 'Q' ? 'queen' :
        pieceChar === 'R' ? 'rook' :
        pieceChar === 'B' ? 'bishop' :
        pieceChar === 'N' ? 'knight' : 'pawn';
        
      return {
        type: pieceType as PieceType,
        color: playerColor
      };
    } catch (error) {
      console.error('Error extracting piece info from notation:', error);
      return null;
    }
  }, []);

  // Initialize the chess board with pieces in standard positions
  useEffect(() => {
    // Initialize move history
    const initialHistory = initializeMoveHistory();
    setMoveHistory(initialHistory);
    setBoardState(initialHistory.initialBoardState);
    
    // Notify parent component of initial state
    if (onMoveHistoryChange) {
      onMoveHistoryChange(initialHistory);
    }
  }, [onMoveHistoryChange]);
  
  // Listen for opponent moves via socket
  useEffect(() => {
    if (!socket) return;

    // Handle move synchronization issues by adding a board synchronization event
    const handleBoardSync = (data: { fen: string, gameId: string }) => {
      console.log('Received board sync:', data);
      try {
        // Synchronize the board state from the FEN - use the existing utility
        const newBoardState = synchronizeBoardFromFen(data.fen);
        
        // Update the board state
        setBoardState(newBoardState);
        console.log('Board synchronized successfully with FEN:', data.fen);
        
        // Create a new move history based on this state
        const newHistory = {
          ...moveHistory,
          moves: moveHistory.moves,
          currentMoveIndex: moveHistory.moves.length - 1,
          initialBoardState: newBoardState,
        };
        
        // Update the move history
        setMoveHistory(newHistory);
        
        // Notify the parent
        if (onMoveHistoryChange) {
          onMoveHistoryChange(newHistory);
        }
      } catch (error) {
        console.error('Failed to synchronize board state:', error);
      }
    };

    const handleOpponentMove = (data: { 
      from: string, 
      to: string, 
      player: string, 
      notation: string,
      gameId: string,
      promotion?: PieceType,
      isCapture?: boolean,
      fen?: string
    }) => {
      console.log('Received move from opponent:', data);
      
      // If player colors are set, only process if it's the opponent's move
      if (playerColor && data.player !== playerColor) {
        console.log(`Processing opponent move. Our color: ${playerColor}, move made by: ${data.player}`);
        
        // Check if we need to resync based on current state
        const currentFen = getFen();
        console.log('Current board state FEN:', currentFen);
        
        // ENHANCED ERROR HANDLING: Try FEN synchronization first in all cases
        if (data.fen) {
          try {
            console.log('Using provided FEN for synchronization:', data.fen);
            
            // Use the existing synchronization function
            const newBoardState = synchronizeBoardFromFen(data.fen);
            
            // Extract piece information from the move
            const movingPiece = extractPieceInfoFromNotation(data.notation, data.player as PieceColor);
            
            if (movingPiece) {
              // Add the move to history
              const newHistory = addMove(moveHistory, {
                from: data.from,
                to: data.to,
                piece: movingPiece,
                notation: data.notation,
                promotion: data.promotion
              }, newBoardState);
              
              // Update all the state
              setMoveHistory(newHistory);
              setBoardState(newBoardState);
              setLastMove({ from: data.from, to: data.to });
              setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
              
              // Notify parent
              if (onMoveHistoryChange) {
                onMoveHistoryChange(newHistory);
              }
              
              console.log('Successfully synchronized with FEN');
              return; // Success! Exit early
            }
          } catch (error) {
            console.error('Error synchronizing from FEN:', error);
            // Continue to fallback methods
          }
        }
        
        // FALLBACK APPROACH: Try to make the move directly
        try {
          // Try to find the piece that would be moving
          const movingPiece = findMovingPiece(data.from, boardState) || 
                             extractPieceInfoFromNotation(data.notation, data.player as PieceColor);
          
          if (!movingPiece) {
            console.error('Could not determine which piece is moving from', data.from);
            console.log('Current board state:', boardState);
            
            // Request a board sync
            console.warn("Requesting resync due to invalid move");
            if (socket && data.gameId) {
              socket.emit('request_board_sync', { 
                gameId: data.gameId,
                reason: 'invalid_move',
                clientState: getFen()
              });
            }
            return;
          }
          
          // Try to make the move in the engine
          console.log(`Attempting to make move: ${data.from} -> ${data.to}${data.promotion ? ` promoting to ${data.promotion}` : ''}`);
          const moveSuccess = makeMove(data.from, data.to, data.promotion);
          
          if (moveSuccess) {
            console.log('Move applied successfully through direct move method');
            
            // Update board state
            const newBoardState = getCurrentBoardState();
            
            // Add to history
            const newHistory = addMove(moveHistory, {
              from: data.from,
              to: data.to,
              piece: movingPiece,
              notation: data.notation,
              promotion: data.promotion
            }, newBoardState);
            
            // Update state
            setMoveHistory(newHistory);
            setBoardState(newBoardState);
            setLastMove({ from: data.from, to: data.to });
            setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
            
            // Notify parent
            if (onMoveHistoryChange) {
              onMoveHistoryChange(newHistory);
            }
          } else {
            console.error(`Failed to apply move: ${data.from} -> ${data.to}. Error making move:`, { from: data.from, to: data.to });
            
            // LAST RESORT FALLBACK: If move fails, try a position reset before requesting sync
            try {
              console.log('Attempting position reset as last resort');
              // Reset the chess engine
              resetChessEngine();
              
              // Try the move again after reset
              const retrySuccess = makeMove(data.from, data.to, data.promotion);
              
              if (retrySuccess) {
                console.log('Move succeeded after position reset');
                
                // Update board state
                const newBoardState = getCurrentBoardState();
                
                // Add to history
                const newHistory = addMove(moveHistory, {
                  from: data.from,
                  to: data.to,
                  piece: movingPiece,
                  notation: data.notation,
                  promotion: data.promotion
                }, newBoardState);
                
                // Update state
                setMoveHistory(newHistory);
                setBoardState(newBoardState);
                setLastMove({ from: data.from, to: data.to });
                setCurrentPlayer(data.player === 'white' ? 'black' : 'white');
                
                // Notify parent
                if (onMoveHistoryChange) {
                  onMoveHistoryChange(newHistory);
                }
              } else {
                // If all methods fail, request a sync from the server
                console.warn('All move application methods failed, requesting board sync');
                if (socket && data.gameId) {
                  socket.emit('request_board_sync', { 
                    gameId: data.gameId,
                    reason: 'all_methods_failed',
                    clientState: getFen()
                  });
                }
              }
            } catch (resetError) {
              console.error('Error during last resort reset:', resetError);
              if (socket && data.gameId) {
                socket.emit('request_board_sync', { 
                  gameId: data.gameId,
                  reason: 'error_during_reset',
                  clientState: getFen()
                });
              }
            }
          }
        } catch (error) {
          console.error('Error handling opponent move:', error);
          if (socket && data.gameId) {
            socket.emit('request_board_sync', { 
              gameId: data.gameId,
              reason: 'handle_move_error',
              clientState: getFen()
            });
          }
        }
      }
    };

    socket.on('move_made', handleOpponentMove);
    socket.on('board_sync', handleBoardSync);

    return () => {
      socket.off('move_made', handleOpponentMove);
      socket.off('board_sync', handleBoardSync);
    };
  }, [socket, playerColor, gameId, boardState, moveHistory, onMoveHistoryChange, findMovingPiece, extractPieceInfoFromNotation]);

  // Handle going back one move
  const handleGoBack = useCallback(() => {
    const { newHistory, boardState: newBoardState } = goBackOneMove(moveHistory);
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const prevMoveIndex = newHistory.currentMoveIndex;
    if (prevMoveIndex >= 0) {
      const prevMove = newHistory.moves[prevMoveIndex];
      setLastMove({ from: prevMove.from, to: prevMove.to });
    } else {
      setLastMove(null);
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // Handle going forward one move
  const handleGoForward = useCallback(() => {
    const { newHistory, boardState: newBoardState } = goForwardOneMove(moveHistory);
    setMoveHistory(newHistory);
    setBoardState(newBoardState);
    
    const nextMoveIndex = newHistory.currentMoveIndex;
    if (nextMoveIndex >= 0) {
      const nextMove = newHistory.moves[nextMoveIndex];
      setLastMove({ from: nextMove.from, to: nextMove.to });
    }
    
    if (onMoveHistoryChange) {
      onMoveHistoryChange(newHistory);
    }
  }, [moveHistory, onMoveHistoryChange]);

  // Check if a move requires pawn promotion
  const isPawnPromotion = useCallback((from: string, to: string, piece: { type: PieceType, color: PieceColor }) => {
    // Only pawns can be promoted
    if (piece.type !== 'pawn') return false;
    
    // Get the rank (row) of the destination square
    const destRank = parseInt(to[1]);
    
    // White pawns are promoted on rank 8, black pawns on rank 1
    return (piece.color === 'white' && destRank === 8) || 
           (piece.color === 'black' && destRank === 1);
  }, []);

  // Calculate position for promotion selector
  const calculatePromotionPosition = useCallback((position: string) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    
    // Get the file (column) of the position (a-h)
    const file = position.charAt(0);
    // Get the rank (row) of the position (1-8)
    const rank = parseInt(position.charAt(1));
    
    // Convert file to column index (a=0, b=1, etc.)
    const colIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
    
    // Get board dimensions
    const boardRect = boardRef.current.getBoundingClientRect();
    const squareSize = boardRect.width / 8;
    
    // Calculate x position based on column
    // Adjust if the piece is near the edge to keep the selector on the board
    let adjustedCol = perspective === 'black' ? 7 - colIndex : colIndex;
    
    // If too close to the right edge, shift left
    if (adjustedCol > 5) {
      adjustedCol = 5;
    }
    
    // Calculate x position (centered on the square)
    const x = adjustedCol * squareSize;
    
    return { x, y: 0 };
  }, [perspective]);

  // Handle promotion piece selection
  const handlePromotionSelect = useCallback((promotionPiece: PieceType) => {
    if (!promotionMove) return;

    const { from, to, piece } = promotionMove;

    // Make the move in the local chess engine first
    const moveSuccess = makeMove(from, to, promotionPiece);

    if (moveSuccess) {
      const newBoardState = getCurrentBoardState();
      const gameStatus = getGameStatus();
      const currentFen = getFen();

      // Determine if it was a capture. Check the board state *before* this move.
      // `boardState` (React state) is the state before this current move was applied to it.
      let isCapture = false;
      const toRowIndex = 8 - parseInt(to[1], 10);
      const toColIndex = to.charCodeAt(0) - 'a'.charCodeAt(0);
      if (boardState.squares[toRowIndex] && 
          boardState.squares[toRowIndex][toColIndex] && 
          boardState.squares[toRowIndex][toColIndex].piece) {
        isCapture = true;
      }

      // Generate notation using the local utility.
      // The 'piece' for generateNotation should be the pawn that moved.
      const notation = generateNotation(from, to, piece, isCapture, promotionPiece, gameStatus.isCheck, gameStatus.isCheckmate);
      
      const newHistory = addMove(
        moveHistory,
        {
          from,
          to,
          piece: { type: promotionPiece, color: piece.color },
          notation,
          promotion: promotionPiece,
        },
        newBoardState,
      );

      setMoveHistory(newHistory);
      setBoardState(newBoardState);
      setLastMove({ from, to });
      setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
      if (onMoveHistoryChange) {
        onMoveHistoryChange(newHistory);
      }

      if (socket && playerColor === piece.color) {
        const movePayload = {
          from,
          to,
          player: piece.color,
          notation, 
          promotion: promotionPiece,
          isCapture,
          fen: currentFen,
          gameId: gameId || socket.id,
        };
        console.log('[ChessBoard] Emitting move_made (promotion selection): ', JSON.stringify(movePayload));
        socket.emit('move_made', movePayload);
      }
      
      if (gameStatus.isGameOver) {
        console.log('Game Over after promotion:', gameStatus);
        // Optional: Dispatch a custom event for game over to be handled elsewhere
        // This depends on how game over is globally managed.
        // Example:
        // if (typeof window !== 'undefined') {
        //     window.dispatchEvent(new CustomEvent('game_ended', {
        //         detail: { /* appropriate game end details from gameStatus */ }
        //     }));
        // }
      }
    }

    setShowPromotion(false);
    setPromotionMove(null);
  }, [boardState, promotionMove, playerColor, gameId, socket, moveHistory, currentPlayer, onMoveHistoryChange]);

  // Handle square click for move selection
  const handleSquareClick = (position: string, piece: { type: PieceType, color: PieceColor } | null) => {
    // If we're in replay mode, don't allow moves
    if (moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0) {
      return;
    }
    
    // Debug logs
    console.log("CLICK - playerColor:", playerColor, "currentPlayer:", currentPlayer);
    
    // If a square was already selected (making a move)
    if (selectedSquare) {
      // PRIMARY RESTRICTION: Only allow players to move their own color
      if (playerColor) {
        // Find the selected piece
        let selectedPiece: { type: PieceType, color: PieceColor } | null = null;
        
        for (const row of boardState.squares) {
          for (const square of row) {
            if (square.position === selectedSquare && square.piece) {
              selectedPiece = square.piece;
              break;
            }
          }
        }
        
        // If we found a piece and it's not the player's color, cancel selection
        if (selectedPiece && selectedPiece.color !== playerColor) {
          console.log(`Cannot move ${selectedPiece.color} pieces when you are ${playerColor}`);
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      }
      
      // Check if the clicked square is in legal moves
      if (legalMoves.includes(position)) {
        // Find the piece that's moving
        let movingPiece: { type: PieceType, color: PieceColor } | null = null;
        
        // Search through boardState to find the piece at selectedSquare
        boardStateLoop:
        for (const row of boardState.squares) {
          for (const square of row) {
            if (square.position === selectedSquare && square.piece) {
              movingPiece = square.piece;
              break boardStateLoop;
            }
          }
        }
        
        if (movingPiece) {
          // Double check the moving piece belongs to current player
          if (movingPiece.color !== currentPlayer) {
            console.log(`Cannot move ${movingPiece.color} pieces on ${currentPlayer}'s turn`);
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
          
          // Check if this move would be a pawn promotion
          if (isPawnPromotion(selectedSquare, position, movingPiece)) {
            // Show promotion selector
            const promotionPos = calculatePromotionPosition(position);
            setPromotionMove({
              from: selectedSquare,
              to: position,
              piece: movingPiece,
              position: promotionPos
            });
            setShowPromotion(true);
          } else {
            // Check if there's a piece at destination (capture)
            let isCapture = false;
            for (const row of boardState.squares) {
              for (const square of row) {
                if (square.position === position && square.piece) {
                  isCapture = true;
                  break;
                }
              }
            }
            
          // Try to make the move in chess.js
          const moveSuccess = makeMove(selectedSquare, position);
          
          if (moveSuccess) {
            // Update board state based on chess.js
            const newBoardState = getCurrentBoardState();
            
            // Add move to history
              const notation = generateNotation(selectedSquare, position, movingPiece, isCapture);
            const newHistory = addMove(moveHistory, {
              from: selectedSquare,
              to: position,
              piece: movingPiece,
              notation
            }, newBoardState);
            
            // Update state
            setMoveHistory(newHistory);
            setBoardState(newBoardState);
            setLastMove({ from: selectedSquare, to: position });
            setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
            
            // Notify parent
            if (onMoveHistoryChange) {
              onMoveHistoryChange(newHistory);
            }
            
            // Check game status
            const gameStatus = getGameStatus();
            if (gameStatus.isGameOver) {
              // Handle game over
              console.log('Game over:', gameStatus);
              }
              
              // Get current FEN for synchronization
              let currentFen = '';
              try {
                const chess = getChessEngine();
                currentFen = chess.fen();
              } catch (error) {
                console.error('Error getting FEN:', error);
              }
              
              // Emit this move to other players via socket
              if (socket && playerColor === movingPiece.color) {
                socket.emit('move_made', {
                  from: selectedSquare,
                  to: position,
                  player: movingPiece.color,
                  notation,
                  isCapture,
                  fen: currentFen, // Add FEN for better synchronization
                  gameId: gameId || socket.id
                });
              }
            }
          }
        }
      }
      
      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    } 
    // If no square was selected and the player clicked on a piece (selecting a piece)
    else if (piece) {
      // PRIMARY RESTRICTION: If playerColor is set, only allow selection of that color's pieces
      if (playerColor && piece.color !== playerColor) {
        console.log(`Cannot select ${piece.color} pieces when you are ${playerColor}`);
        return;
      }
      
      // Only allow selection of pieces that match the current turn
      if (piece.color !== currentPlayer) {
        console.log(`Cannot select ${piece.color} pieces on ${currentPlayer}'s turn`);
        return;
      }
      
      // Set the selected square and calculate legal moves
      setSelectedSquare(position);
      
      // Get all legal moves for this piece directly from chess.js
      try {
        // Use standard chess notation for the position
      const legalDestinations: string[] = [];
      
        // Get all legal moves for the current piece
        const chess = getChessEngine();
        const legalMoves = chess.moves({
          square: position as any,
          verbose: true
        }) as any[];
        
        // Extract the destination squares
        if (legalMoves && legalMoves.length > 0) {
          for (const move of legalMoves) {
            if (move && move.to) {
              legalDestinations.push(move.to);
          }
        }
      }
      
      setLegalMoves(legalDestinations);
      } catch (err) {
        console.error("Error calculating legal moves:", err);
        setLegalMoves([]);
      }
    }
  };

  // Determine if a square should be dark or light
  const isSquareDark = (row: number, col: number) => {
    return (row + col) % 2 !== 0;
  };
  
  // Check if a square is part of the last move
  const isLastMoveSquare = (position: string) => {
    if (!lastMove) return false;
    return position === lastMove.from || position === lastMove.to;
  };

  // Check if a square is selected
  const isSelectedSquare = (position: string) => {
    return position === selectedSquare;
  };

  // Check if a square is a legal move destination
  const isLegalMoveSquare = (position: string) => {
    return legalMoves.includes(position);
  };

  // Get the background color for a square
  const getSquareBackground = (row: number, col: number, position: string) => {
    const isDark = isSquareDark(row, col);
    const isLastMove = isLastMoveSquare(position);
    const isSelected = isSelectedSquare(position);
    const isLegalMove = isLegalMoveSquare(position);
    
    if (isSelected) {
      return isDark ? 'bg-blue-700' : 'bg-blue-500';
    } else if (isLegalMove) {
      return isDark ? 'bg-green-700' : 'bg-green-500';
    } else if (isLastMove) {
      return isDark ? 'bg-amber-600' : 'bg-amber-400';
    }
    
    return isDark ? 'bg-[#6D8884]' : 'bg-[#FAF3DD]';
  };

  // If perspective is black, reverse the board
  const displayBoard = perspective === 'black' 
    ? [...boardState.squares].reverse().map(row => [...row].reverse()) 
    : boardState.squares;

  return (
    <div className="w-full mx-auto relative">
      {/* Top border for mobile - only shows on small screens */}
      <div className="block sm:hidden h-[13px] bg-[#333939] w-full m-0 p-0"></div>
      
      <div 
        ref={boardRef}
        className={`aspect-square grid grid-cols-8 grid-rows-8 border-0 sm:border-[13px] sm:border-[#333939] sm:rounded-sm shadow-md ${showPromotion ? 'filter blur-sm' : ''}`}
      >
        {displayBoard.map((row, rowIndex) => (
          row.map((square, colIndex) => {
            return (
              <div 
                key={`${rowIndex}-${colIndex}`}
                className={`
                  flex items-center justify-center
                  ${getSquareBackground(rowIndex, colIndex, square.position)}
                  cursor-pointer
                `}
                onClick={() => handleSquareClick(square.position, square.piece)}
              >
                {square.piece && (
                  <ChessPiece
                    type={square.piece.type}
                    color={square.piece.color}
                  />
                )}
                {isLegalMoveSquare(square.position) && !square.piece && (
                  <div className="w-3 h-3 rounded-full bg-green-500 opacity-60"></div>
                )}
              </div>
            );
          })
        ))}
      </div>
      
      {/* Bottom border for mobile - only shows on small screens */}
      <div className="block sm:hidden h-[13px] bg-[#333939] w-full m-0 p-0"></div>
      
      {/* Pawn promotion selector */}
      {showPromotion && promotionMove && (
        <PromotionSelector
          color={promotionMove.piece.color}
          onSelect={handlePromotionSelect}
          position={promotionMove.position}
        />
      )}
      
      {/* Export these controls so parent can use them */}
      <div className="hidden">
        <button onClick={handleGoBack}>Back</button>
        <button onClick={handleGoForward}>Forward</button>
      </div>
    </div>
  );
};

export default ChessBoard; 
