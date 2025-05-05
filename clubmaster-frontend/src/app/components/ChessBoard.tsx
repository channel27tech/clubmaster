'use client';

import { useState, useEffect, useCallback } from 'react';
import ChessPiece from './ChessPiece';
import { BoardState, BoardSquare, initializeMoveHistory, MoveHistoryState, goBackOneMove, goForwardOneMove, addMove, generateNotation, PieceType, PieceColor } from '../utils/moveHistory';

// Example mock moves for demonstration purposes
const mockMoves = [
  { from: 'e2', to: 'e4', piece: { type: 'pawn' as PieceType, color: 'white' as PieceColor } },
  { from: 'e7', to: 'e5', piece: { type: 'pawn' as PieceType, color: 'black' as PieceColor } },
  { from: 'g1', to: 'f3', piece: { type: 'knight' as PieceType, color: 'white' as PieceColor } },
  { from: 'b8', to: 'c6', piece: { type: 'knight' as PieceType, color: 'black' as PieceColor } },
];

interface ChessBoardProps {
  perspective?: 'white' | 'black';
  onMoveHistoryChange?: (moveHistory: MoveHistoryState) => void;
}

const ChessBoard = ({ perspective = 'white', onMoveHistoryChange }: ChessBoardProps) => {
  const [moveHistory, setMoveHistory] = useState<MoveHistoryState>(() => initializeMoveHistory());
  const [boardState, setBoardState] = useState<BoardState>(moveHistory.initialBoardState);
  const [lastMove, setLastMove] = useState<{ from: string, to: string } | null>(null);

  // Initialize the chess board with pieces in standard positions
  useEffect(() => {
    // Initialize move history
    const initialHistory = initializeMoveHistory();
    setMoveHistory(initialHistory);
    setBoardState(initialHistory.initialBoardState);
    
    // Simulating moves for testing the replay functionality
    // In a real app, this would come from actual gameplay or a game record
    setTimeout(() => {
      let currentHistory = initialHistory;
      let currentBoardState = { ...initialHistory.initialBoardState };
      
      for (const move of mockMoves) {
        // Update board state (in a real app, this would be calculated based on chess rules)
        const newBoardState = simulateMove(currentBoardState, move.from, move.to, move.piece);
        
        // Add move to history
        const notation = generateNotation(move.from, move.to, move.piece);
        currentHistory = addMove(currentHistory, { ...move, notation }, newBoardState);
        currentBoardState = newBoardState;
      }
      
      setMoveHistory(currentHistory);
      setBoardState(currentHistory.moves[currentHistory.moves.length - 1].boardState);
      setLastMove({
        from: mockMoves[mockMoves.length - 1].from,
        to: mockMoves[mockMoves.length - 1].to
      });
      
      if (onMoveHistoryChange) {
        onMoveHistoryChange(currentHistory);
      }
    }, 500);
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

  // Determine if a square should be dark or light
  const isSquareDark = (row: number, col: number) => {
    return (row + col) % 2 !== 0;
  };
  
  // Check if a square is part of the last move
  const isLastMoveSquare = (position: string) => {
    if (!lastMove) return false;
    return position === lastMove.from || position === lastMove.to;
  };

  // Get the background color for a square
  const getSquareBackground = (row: number, col: number, position: string) => {
    const isDark = isSquareDark(row, col);
    const isLastMove = isLastMoveSquare(position);
    
    if (isLastMove) {
      return isDark ? 'bg-amber-600' : 'bg-amber-400';
    }
    
    return isDark ? 'bg-[#6D8884]' : 'bg-[#FAF3DD]';
  };

  // If perspective is black, reverse the board
  const displayBoard = perspective === 'black' 
    ? [...boardState.squares].reverse().map(row => [...row].reverse()) 
    : boardState.squares;

  return (
    <div className="w-full mx-auto">
      <div className="aspect-square grid grid-cols-8 grid-rows-8 border-8 rounded-sm border-[#333939]">
        {displayBoard.map((row, rowIndex) => (
          row.map((square, colIndex) => {
            return (
              <div 
                key={`${rowIndex}-${colIndex}`}
                className={`
                  flex items-center justify-center
                  ${getSquareBackground(rowIndex, colIndex, square.position)}
                `}
              >
                {square.piece && (
                  <ChessPiece
                    type={square.piece.type}
                    color={square.piece.color}
                  />
                )}
              </div>
            );
          })
        ))}
      </div>
      
      {/* Export these controls so parent can use them */}
      <div className="hidden">
        <button onClick={handleGoBack}>Back</button>
        <button onClick={handleGoForward}>Forward</button>
      </div>
    </div>
  );
};

// Helper function to simulate moving a piece (in a real app, this would be determined by chess rules)
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