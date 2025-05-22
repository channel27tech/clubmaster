import { Chess } from 'chess.js';
import { PieceType, PieceColor } from './types';
import { BoardState, BoardSquare } from './moveHistory';

// Store FEN in localStorage for persistence
const CHESS_STATE_KEY = 'chess_engine_state';
// Add a separate key for the current game ID
const CURRENT_GAME_KEY = 'chess_current_game';

// Get stored FEN or use default
const getStoredFen = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CHESS_STATE_KEY);
};

// Save FEN to localStorage with game ID
const storeFen = (fen: string, gameId?: string): void => {
  if (typeof window === 'undefined') return;
  
  // Store the FEN
  localStorage.setItem(CHESS_STATE_KEY, fen);
  
  // If gameId is provided, store it too
  if (gameId) {
    localStorage.setItem(CURRENT_GAME_KEY, gameId);
  }
};

// Get the stored game ID
const getStoredGameId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CURRENT_GAME_KEY);
};

// Singleton chess engine instance
let chessInstance: Chess | null = null;
// Track the current game ID
let currentGameId: string | null = null;

// Initialize the chess engine with standard position or stored state
export const getChessEngine = (gameId?: string): Chess => {
  // If gameId is provided, check if it matches the stored game ID
  if (gameId && gameId !== currentGameId) {
    // If game ID changed, force a reset
    console.log('Game ID changed, resetting chess engine');
    resetChessEngine();
    currentGameId = gameId;
    // Store the new game ID
    if (typeof window !== 'undefined') {
      localStorage.setItem(CURRENT_GAME_KEY, gameId);
    }
  }

  if (!chessInstance) {
    try {
      const storedFen = getStoredFen();
      const storedGameId = getStoredGameId();
      
      // Only use stored FEN if the game IDs match or no gameId was specified
      if (storedFen && (!gameId || gameId === storedGameId)) {
        // Validate FEN first before trying to use it
        const tempChess = new Chess();
        try {
          tempChess.load(storedFen);
          // If no exception was thrown, the FEN is valid
          console.log('Restoring chess engine from stored state:', storedFen);
          chessInstance = tempChess; // Use the already loaded instance
        } catch (error) {
          console.error('Invalid stored FEN format, using default position');
          chessInstance = new Chess(); // Fallback to default
        }
      } else {
        // Use default starting position
        console.log('No valid stored state, initializing with default position');
        chessInstance = new Chess();
      }
    } catch (error) {
      console.error('Error initializing chess engine:', error);
      chessInstance = new Chess(); // Fallback to default
    }
  }
  return chessInstance;
};

// Reset the chess engine to initial position
export const resetChessEngine = (): Chess => {
  chessInstance = new Chess();
  // Clear stored state
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CHESS_STATE_KEY);
    localStorage.removeItem(CURRENT_GAME_KEY);
  }
  currentGameId = null;
  return chessInstance;
};

// Set the chess engine to a particular position using FEN
export const setChessPosition = (fen: string, gameId?: string): boolean => {
  try {
    if (!fen || typeof fen !== 'string') {
      console.error('Invalid FEN string provided:', fen);
      return false;
    }
    
    // Use a fresh chess instance to validate the FEN
    const validationChess = new Chess();
    const isValid = validationChess.load(fen);
    
    if (!isValid) {
      console.error('Invalid FEN string format:', fen);
      return false;
    }
    
    // If the FEN is valid, reset and use the validated instance
    chessInstance = validationChess;
    
    // Store the new state with game ID if provided
    storeFen(fen, gameId);
    
    // Update current game ID
    if (gameId) {
      currentGameId = gameId;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting chess position:', error);
    return false;
  }
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
    // Convert string coordinates to chess.js Square type
    const fromSquare = from as any;
    const toSquare = to as any;
    // Get the piece at the 'from' position to check if it's a pawn that might need promotion
    const piece = chess.get(from);
    
    // Check if this is a potential pawn promotion move
    const isPawnPromotionMove = 
      piece?.type === 'p' && // It's a pawn
      ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1')); // Moving to the last rank
    
    if (isPawnPromotionMove && !promotion) {
      // For checking legal moves, if no promotion is specified, default to 'queen'
      // This allows showing the move as legal in the UI, and then prompting for the promotion piece
      console.log(`Potential pawn promotion detected: ${from} -> ${to}`);
    }
    
    // Check if move is legal
    const move = {
      from: fromSquare,
      to: toSquare,
      promotion: promotion ? pieceTypeMapping[promotion] : undefined
    };
    
    // Try the move and undo it to check if it's legal
    const result = chess.move(move);
    if (result) {
      chess.undo(); // Undo the move to keep the board state unchanged
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking move legality:', error);
    return false;
  }
};

// Make a move and return if it was successful
export const makeMove = (from: string, to: string, promotion?: PieceType): boolean => {
  const chess = getChessEngine();
  
  try {
    // Convert string coordinates to chess.js Square type
    const fromSquare = from as any;
    const toSquare = to as any;
    // Get the piece at the 'from' position to check if it's a pawn that might need promotion
    const piece = chess.get(from);
    
    // Check if this is a pawn promotion move
    const isPawnPromotionMove = 
      piece?.type === 'p' && // It's a pawn
      ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1')); // Moving to the last rank
    
    // If this is a pawn promotion move but no promotion piece specified, we can't complete the move
    if (isPawnPromotionMove && !promotion) {
      console.warn('Attempted to make a pawn promotion move without specifying the promotion piece');
      return false;
    }
    
    // Make the move
    const move = {
      from: fromSquare,
      to: toSquare,
      promotion: promotion ? pieceTypeMapping[promotion] : undefined
    };
    
    const result = chess.move(move);
    
    // If move was successful, store the new position
    if (result) {
      console.log(`Move made: ${result.san}`);
      // Store the new FEN state after a successful move
      storeFen(chess.fen(), currentGameId || undefined);
    } else {
      console.error('Error making direct move:', new Error(`Invalid move: ${JSON.stringify(move)}`));
    }
    
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
    if (result) {
      // Update stored state after undo
      storeFen(chess.fen(), currentGameId || undefined);
    }
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
  
  // Create the board state
  return {
    squares,
    capturedPieces: {
      white: [],
      black: []
    }
  };
};

// Get the current game status
export const getGameStatus = () => {
  const chess = getChessEngine();
  
  return {
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    isStalemate: chess.isStalemate(),
    isThreefoldRepetition: chess.isThreefoldRepetition(),
    isInsufficientMaterial: chess.isInsufficientMaterial(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    fen: chess.fen()
  };
};

// Check if the position is a threefold repetition
export const isThreefoldRepetition = (): boolean => {
  try {
    const chess = getChessEngine();
    // The chess.js isThreefoldRepetition() returns a boolean indicating if the current position has occurred three or more times
    const result = chess.isThreefoldRepetition();
    console.log(`Threefold repetition check result: ${result}`);
    return result === true;
  } catch (error) {
    console.error('Error checking for threefold repetition:', error);
    return false; // Return false on error to avoid false positives
  }
};

// Load a PGN
export const loadPgn = (pgn: string): boolean => {
  const chess = getChessEngine();
  
  try {
    // Load the PGN
    chess.loadPgn(pgn);
    
    // Store the new position
    storeFen(chess.fen());
    
    return true;
  } catch (error) {
    console.error('Error loading PGN:', error);
    return false;
  }
};

// Get the current game PGN
export const getPgn = (): string => {
  const chess = getChessEngine();
  try {
    return chess.pgn();
  } catch (error) {
    console.error('Error getting PGN:', error);
    return '';
  }
};

// Get move history in standard algebraic notation
export const getMoveHistory = (): string[] => {
  const chess = getChessEngine();
  try {
    return chess.history();
  } catch (error) {
    console.error('Error getting move history:', error);
    return [];
  }
};

// Get FEN of the current position
export const getFen = (): string => {
  const chess = getChessEngine();
  return chess.fen();
}; 