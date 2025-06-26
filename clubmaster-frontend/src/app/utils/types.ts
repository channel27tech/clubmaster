// Chess piece types
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

// Import BetType from the bet types file
import { BetType } from '@/types/bet';

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
  userId?: string; // Add userId for bet result handling
  photoURL?: string | null; // Add photoURL for player avatars
}

// Interface for a board square
export interface BoardSquare {
  piece: {
    type: PieceType;
    color: PieceColor;
  } | null;
  position: string;
}

// Game result types
export type GameResultType = 'win' | 'loss' | 'draw';
export type GameEndReason = 
  | 'checkmate'
  | 'timeout'
  | 'resignation'
  | 'draw_agreement'
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'abort';

// Game result interface
export interface GameResult {
  result: GameResultType;
  reason: GameEndReason;
  playerName: string;
  opponentName: string;
  playerRating: number;
  opponentRating: number;
  playerPhotoURL?: string | null;
  opponentPhotoURL?: string | null;
  playerRatingChange: number;
  opponentRatingChange: number;
  // Bet-specific properties
  betType?: BetType;
  isBetGameWinner?: boolean;
  opponentNameForBetContext?: string;
  opponentIdForBetContext?: string;
  opponentNameForBetMessage?: string;
  stakeAmount?: number;
} 