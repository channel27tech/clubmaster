
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ChessPiece from './ChessPiece';
import PromotionSelector from './PromotionSelector';
import { BoardState, BoardSquare, initializeMoveHistory, MoveHistoryState, goBackOneMove, goForwardOneMove, addMove, generateNotation, PieceType, PieceColor } from '../utils/moveHistory';
import { getChessEngine, resetChessEngine, isLegalMove, makeMove, getGameStatus, getCurrentBoardState } from '../utils/chessEngine';

interface ChessBoardProps {
  perspective?: 'white' | 'black';
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
}

const ChessBoard = ({ perspective = 'white', onMoveHistoryChange }: ChessBoardProps) => {
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
  
  // Initialize the chess engine
  useEffect(() => {
    resetChessEngine();
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

  // Handle promotion piece selection
  const handlePromotionSelect = useCallback((promotionPiece: PieceType) => {
    // Hide promotion selector
    setShowPromotion(false);
    
    if (!promotionMove) return;
    
    const { from, to, piece } = promotionMove;
    
    // Make the move with promotion
    const moveSuccess = makeMove(from, to, promotionPiece);
    
    if (moveSuccess) {
      // Update board state based on chess.js
      const newBoardState = getCurrentBoardState();
      
      // Add move to history with promotion information
      const notation = generateNotation(from, to, piece, false, promotionPiece);
      const newHistory = addMove(moveHistory, {
        from,
        to,
        piece,
        promotion: promotionPiece,
        notation
      }, newBoardState);
      
      // Update state
      setMoveHistory(newHistory);
      setBoardState(newBoardState);
      setLastMove({ from, to });
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
    }
    
    // Clear promotion state
    setPromotionMove(null);
  }, [moveHistory, currentPlayer, onMoveHistoryChange, promotionMove]);

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

  // Handle square click for move selection
  const handleSquareClick = (position: string, piece: { type: PieceType, color: PieceColor } | null) => {
    // If we're in replay mode, don't allow moves
    if (moveHistory.currentMoveIndex !== moveHistory.moves.length - 1 && moveHistory.moves.length > 0) {
      return;
    }
    
    // If a square was already selected
    if (selectedSquare) {
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
            // Try to make the move in chess.js
            const moveSuccess = makeMove(selectedSquare, position);
            
            if (moveSuccess) {
              // Update board state based on chess.js
              const newBoardState = getCurrentBoardState();
              
              // Add move to history
              const notation = generateNotation(selectedSquare, position, movingPiece);
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
            }
          }
        }
      }
      
      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    } 
    // If no square was selected and the player clicked on their own piece
    else if (piece && piece.color === currentPlayer) {
      setSelectedSquare(position);
      
      // Calculate legal moves for this piece
      const legalDestinations: string[] = [];
      
      // Check all squares on the board
      for (const row of boardState.squares) {
        for (const square of row) {
          if (isLegalMove(position, square.position)) {
            legalDestinations.push(square.position);
          }
        }
      }
      
      setLegalMoves(legalDestinations);
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
      <div 
        ref={boardRef}
        className={`aspect-square grid grid-cols-8 grid-rows-8 border-8 rounded-sm border-[#333939] shadow-md ${showPromotion ? 'filter blur-sm' : ''}`}
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

// Helper function to simulate moving a piece - kept for reference only
const simulateMove = (
  currentBoardState: BoardState,
  from: string,
  to: string,
  piece: { type: PieceType, color: PieceColor }
): BoardState => {
  // Create a deep copy of the current board state
  const newBoardState = JSON.parse(JSON.stringify(currentBoardState)) as BoardState;
  
  // Find the source and destination squares
  let fromSquare: BoardSquare | null = null;
  let toSquare: BoardSquare | null = null;
  let fromRow = -1, fromCol = -1;
  let toRow = -1, toCol = -1;
  
  // Locate the squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (newBoardState.squares[row][col].position === from) {
        fromSquare = newBoardState.squares[row][col];
        fromRow = row;
        fromCol = col;
      }
      if (newBoardState.squares[row][col].position === to) {
        toSquare = newBoardState.squares[row][col];
        toRow = row;
        toCol = col;
      }
    }
  }
  
  // Check if we found both squares
  if (!fromSquare || !toSquare) {
    console.error('Could not find squares for move');
    return currentBoardState;
  }
  
  // Check if there's a capture
  if (toSquare.piece) {
    const capturedPiece = toSquare.piece;
    const capturedPieceWithId = {
      ...capturedPiece,
      id: `${capturedPiece.color[0]}${capturedPiece.type[0]}${Date.now()}` // Generate a unique ID
    };
    
    // Add to captured pieces
    if (capturedPiece.color === 'white') {
      newBoardState.capturedPieces.white.push(capturedPieceWithId);
    } else {
      newBoardState.capturedPieces.black.push(capturedPieceWithId);
    }
  }
  
  // Move the piece
  newBoardState.squares[toRow][toCol].piece = fromSquare.piece;
  newBoardState.squares[fromRow][fromCol].piece = null;
  
  return newBoardState;
};

export default ChessBoard; 
