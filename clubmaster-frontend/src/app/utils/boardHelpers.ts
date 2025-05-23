import { BoardState, PieceType, PieceColor } from './moveHistory';

/**
 * Find a piece on the board at a specific position
 */
export const findMovingPiece = (position: string, boardState: BoardState): { type: PieceType, color: PieceColor } | null => {
  for (const row of boardState.squares) {
    for (const square of row) {
      if (square.position === position && square.piece) {
        return { ...square.piece };
      }
    }
  }
  return null;
};

/**
 * Extract piece information from algebraic chess notation
 */
export const extractPieceInfoFromNotation = (notation: string, playerColor: PieceColor): { type: PieceType, color: PieceColor } | null => {
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
};

/**
 * Check if a move would result in pawn promotion
 */
export const isPawnPromotion = (from: string, to: string, piece: { type: PieceType, color: PieceColor }) => {
  // Only pawns can be promoted
  if (piece.type !== 'pawn') return false;
  
  // Get the rank (row) of the destination square
  const destRank = parseInt(to[1]);
  
  // White pawns are promoted on rank 8, black pawns on rank 1
  return (piece.color === 'white' && destRank === 8) || 
          (piece.color === 'black' && destRank === 1);
};

/**
 * Calculate the logical background color of a square
 */
export const isSquareDark = (row: number, col: number) => {
  return (row + col) % 2 !== 0;
};

/**
 * Calculate position for promotion selector
 */
export const calculatePromotionPosition = (position: string, boardRef: React.RefObject<HTMLDivElement>, perspective: 'white' | 'black') => {
  if (!boardRef.current) return { x: 0, y: 0 };
  
  // Get the file (column) of the position (a-h)
  const file = position.charAt(0);
  
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
}; 