import { Chess } from 'chess.js';
import { PieceType, PieceColor } from './types';
import { BoardState, BoardSquare } from './moveHistory';

// Singleton chess engine instance
let chessInstance: Chess | null = null;

// Initialize the chess engine with standard position
export const getChessEngine = (): Chess => {
  if (!chessInstance) {
    chessInstance = new Chess();
  }
  return chessInstance;
};

// Reset the chess engine to initial position
export const resetChessEngine = (): Chess => {
  chessInstance = new Chess();
  return chessInstance;
};

// Set the chess engine to a custom FEN position
export const setChessPosition = (fen: string): Chess => {
  chessInstance = new Chess(fen);
  return chessInstance;
};

// Mapping from our piece types to chess.js piece types
const pieceTypeMapping: Record<PieceType, string> = {
  'pawn': 'p',
  'knight': 'n',
  'bishop': 'b',
  'rook': 'r',
  'queen': 'q',
  'king': 'k'
};

// Check if a move is legal
export const isLegalMove = (from: string, to: string, promotion?: PieceType): boolean => {
  const chess = getChessEngine();
  
  try {
    // chess.js will throw an error for illegal moves
    const moveOptions: { from: string; to: string; promotion?: string } = { from, to };
    
    // Add promotion if specified
    if (promotion) {
      moveOptions.promotion = pieceTypeMapping[promotion];
    }
    
    const result = chess.move(moveOptions);
    
    // Undo the move to maintain the board state
    chess.undo();
    
    // If result is null, the move is illegal
    return result !== null;
  } catch (error) {
    console.error('Error checking move legality:', error);
    return false;
  }
};

// Make a move and return if it was successful
export const makeMove = (from: string, to: string, promotion?: PieceType): boolean => {
  const chess = getChessEngine();
  
  try {
    const moveOptions: { from: string; to: string; promotion?: string } = { from, to };
    
    // Add promotion if specified
    if (promotion) {
      moveOptions.promotion = pieceTypeMapping[promotion];
    }
    
    const result = chess.move(moveOptions);
    return result !== null;
  } catch (error) {
    console.error('Error making move:', error);
    return false;
  }
};

// Undo the last move
export const undoMove = (): boolean => {
  const chess = getChessEngine();
  try {
    const result = chess.undo();
    return result !== null;
  } catch (error) {
    console.error('Error undoing move:', error);
    return false;
  }
};

// Convert chess.js piece to our piece format
const convertChessPiece = (piece: any): { type: PieceType; color: PieceColor } | null => {
  if (!piece) return null;
  
  // Map chess.js piece types to our types
  const pieceTypeMap: Record<string, PieceType> = {
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king'
  };
  
  return {
    type: pieceTypeMap[piece.type],
    color: piece.color === 'w' ? 'white' : 'black'
  };
};

// Get current board state from chess.js
export const getCurrentBoardState = (): BoardState => {
  const chess = getChessEngine();
  const board = chess.board();
  
  const squares: BoardSquare[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Convert chess.js board to our board format
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = String.fromCharCode(97 + col); // 'a' through 'h'
      const rank = 8 - row; // 1 through 8
      const position = `${file}${rank}`;
      
      squares[row][col] = {
        piece: convertChessPiece(board[row][col]),
        position
      };
    }
  }
  
  // For captured pieces, we need to compare with the initial setup
  // This is a simple implementation that doesn't account for promotions
  const capturedPieces = {
    white: [] as any[],
    black: [] as any[]
  };
  
  return {
    squares,
    capturedPieces
  };
};

// Check if the game is over and return the result
export const getGameStatus = () => {
  const chess = getChessEngine();
  
  const isCheck = chess.inCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();
  const isGameOver = chess.isGameOver();
  
  return {
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver,
    turn: chess.turn() === 'w' ? 'white' : 'black'
  };
};

// Load moves from PGN notation
export const loadPgn = (pgn: string): boolean => {
  const chess = getChessEngine();
  try {
    return chess.loadPgn(pgn);
  } catch (error) {
    console.error('Error loading PGN:', error);
    return false;
  }
};

// Get PGN of the current game
export const getPgn = (): string => {
  const chess = getChessEngine();
  return chess.pgn();
};

// Get FEN of the current position
export const getFen = (): string => {
  const chess = getChessEngine();
  return chess.fen();
};

// Get move history in SAN notation
export const getMoveHistory = (): string[] => {
  const chess = getChessEngine();
  return chess.history();
}; 