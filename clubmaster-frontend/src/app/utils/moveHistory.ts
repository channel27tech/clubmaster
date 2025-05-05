import { PieceType, PieceColor } from './types';

// Re-export the types so they can be imported from this file
export type { PieceType, PieceColor };

// Types for move history
export interface ChessMove {
  from: string;
  to: string;
  piece: {
    type: PieceType;
    color: PieceColor;
  };
  capturedPiece?: {
    type: PieceType;
    color: PieceColor;
  };
  promotion?: PieceType;
  check?: boolean;
  checkmate?: boolean;
  notation: string; // Algebraic notation
  boardState: BoardState; // Complete board state after this move
}

export interface BoardState {
  squares: BoardSquare[][];
  capturedPieces: {
    white: CapturedPiece[];
    black: CapturedPiece[];
  };
}

export interface BoardSquare {
  piece: {
    type: PieceType;
    color: PieceColor;
  } | null;
  position: string;
}

export interface CapturedPiece {
  type: PieceType;
  color: PieceColor;
  id: string;
}

export interface MoveHistoryState {
  moves: ChessMove[];
  currentMoveIndex: number;
  initialBoardState: BoardState;
}

// Function to initialize the move history
export const initializeMoveHistory = (): MoveHistoryState => {
  const initialBoardState = getInitialBoardState();
  
  return {
    moves: [],
    currentMoveIndex: -1, // -1 means no moves made yet (at initial position)
    initialBoardState,
  };
};

// Function to add a move to the history
export const addMove = (
  history: MoveHistoryState,
  move: Omit<ChessMove, 'boardState'>,
  newBoardState: BoardState
): MoveHistoryState => {
  // If we're not at the latest move, truncate the future moves
  const updatedMoves = history.currentMoveIndex < history.moves.length - 1
    ? history.moves.slice(0, history.currentMoveIndex + 1)
    : [...history.moves];
  
  // Add the new move with board state
  updatedMoves.push({
    ...move,
    boardState: newBoardState,
  });
  
  return {
    ...history,
    moves: updatedMoves,
    currentMoveIndex: updatedMoves.length - 1,
  };
};

// Function to navigate to a specific move
export const goToMove = (
  history: MoveHistoryState,
  moveIndex: number
): BoardState => {
  // Validate the move index
  if (moveIndex < -1 || moveIndex >= history.moves.length) {
    throw new Error('Invalid move index');
  }
  
  // Return the appropriate board state
  if (moveIndex === -1) {
    return history.initialBoardState;
  } else {
    return history.moves[moveIndex].boardState;
  }
};

// Function to go back one move
export const goBackOneMove = (
  history: MoveHistoryState
): { newHistory: MoveHistoryState, boardState: BoardState } => {
  if (history.currentMoveIndex < 0) {
    return { newHistory: history, boardState: history.initialBoardState };
  }
  
  const newIndex = history.currentMoveIndex - 1;
  const newHistory = {
    ...history,
    currentMoveIndex: newIndex,
  };
  
  const boardState = newIndex === -1 
    ? history.initialBoardState 
    : history.moves[newIndex].boardState;
    
  return { newHistory, boardState };
};

// Function to go forward one move
export const goForwardOneMove = (
  history: MoveHistoryState
): { newHistory: MoveHistoryState, boardState: BoardState } => {
  if (history.currentMoveIndex >= history.moves.length - 1) {
    return { 
      newHistory: history, 
      boardState: history.moves.length === 0 
        ? history.initialBoardState 
        : history.moves[history.currentMoveIndex].boardState 
    };
  }
  
  const newIndex = history.currentMoveIndex + 1;
  const newHistory = {
    ...history,
    currentMoveIndex: newIndex,
  };
  
  return { 
    newHistory, 
    boardState: history.moves[newIndex].boardState 
  };
};

// Helper function to get the initial board state
const getInitialBoardState = (): BoardState => {
  const squares: BoardSquare[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Initialize the board squares with their positions and pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = String.fromCharCode(97 + col); // 'a' through 'h'
      const rank = 8 - row; // 1 through 8
      
      squares[row][col] = {
        piece: null,
        position: `${file}${rank}`
      };
    }
  }

  // Set up pawns
  for (let col = 0; col < 8; col++) {
    squares[1][col].piece = { type: 'pawn', color: 'black' };
    squares[6][col].piece = { type: 'pawn', color: 'white' };
  }

  // Set up other pieces
  const setupPieces = (row: number, color: PieceColor) => {
    const pieceOrder: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let col = 0; col < 8; col++) {
      squares[row][col].piece = { type: pieceOrder[col], color };
    }
  };

  setupPieces(0, 'black');
  setupPieces(7, 'white');
  
  return {
    squares,
    capturedPieces: {
      white: [],
      black: []
    }
  };
};

// Convert position to algebraic notation
export const positionToAlgebraic = (position: string): string => {
  return position.toLowerCase();
};

// Generate algebraic notation for a move
export const generateNotation = (
  from: string,
  to: string,
  piece: { type: PieceType, color: PieceColor },
  capture?: boolean,
  promotion?: PieceType,
  check?: boolean,
  checkmate?: boolean
): string => {
  let notation = '';
  
  // Add piece letter (except for pawns)
  if (piece.type !== 'pawn') {
    notation += piece.type === 'knight' ? 'N' : piece.type.charAt(0).toUpperCase();
  }
  
  // Add from position (for pawns only if capturing)
  if (piece.type === 'pawn' && capture) {
    notation += from.charAt(0);
  }
  
  // Add capture symbol
  if (capture) {
    notation += 'x';
  }
  
  // Add destination position
  notation += to.toLowerCase();
  
  // Add promotion
  if (promotion) {
    notation += '=' + (promotion === 'knight' ? 'N' : promotion.charAt(0).toUpperCase());
  }
  
  // Add check/checkmate
  if (checkmate) {
    notation += '#';
  } else if (check) {
    notation += '+';
  }
  
  return notation;
}; 