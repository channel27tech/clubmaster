// Chess piece types
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

// Captured piece interface
export interface CapturedPiece {
  type: PieceType;
  color: PieceColor;
  id: string;
}

// Player data interface
export interface PlayerData {
  id?: string; // Optional ID for player identification
  username: string;
  rating?: number;
  clubAffiliation?: string;
  isGuest: boolean;
  capturedPieces: CapturedPiece[];
}

// Interface for a board square
export interface BoardSquare {
  piece: {
    type: PieceType;
    color: PieceColor;
  } | null;
  position: string;
} 