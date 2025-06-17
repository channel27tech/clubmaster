// Defines the different types of bets available in the system
export enum BetType {
  PROFILE_CONTROL = 'profile_control',
  PROFILE_LOCK = 'profile_lock',
  RATING_STAKE = 'rating_stake',
}

// Status of a bet challenge
export enum BetStatus {
  PENDING = 'pending',    // Challenge has been sent but not accepted
  ACCEPTED = 'accepted',  // Challenge has been accepted, game will start
  REJECTED = 'rejected',  // Challenge was rejected
  CANCELLED = 'cancelled', // Challenge was cancelled before response
  COMPLETED = 'completed', // Game has been played and bet resolved
  EXPIRED = 'expired',     // Challenge expired without response
}

// Represents a bet challenge between two players
export interface BetChallenge {
  id: string;                 // Unique identifier for the bet
  challengerId: string;       // User ID of the challenger
  challengerSocketId: string; // Socket ID of the challenger
  opponentId?: string;        // User ID of the opponent (if directly challenging a user)
  opponentSocketId?: string;  // Socket ID of the opponent (if directly challenging a user)
  betType: BetType;           // Type of bet
  stakeAmount?: number;       // Amount of rating points at stake (for RATING_STAKE)
  gameMode: string;           // Game mode (Bullet, Blitz, Rapid)
  timeControl: string;        // Time control (e.g. "3+0", "5+0", "10+0")
  preferredSide: string;      // Preferred side (white, black, random)
  status: BetStatus;          // Current status of the bet
  createdAt: Date;            // When the bet was created
  expiresAt: Date;            // When the bet challenge expires
  gameId?: string;            // ID of the game if bet was accepted
  winnerId?: string;          // ID of the winner after game completion
  resultApplied: boolean;     // Whether the bet result has been applied
}

// Response to a bet challenge
export interface BetChallengeResponse {
  challengeId: string;        // ID of the bet challenge being responded to
  accepted: boolean;          // Whether the challenge was accepted
  responderId: string;        // User ID of the responder
  responderSocketId: string;  // Socket ID of the responder
}

// Result of a bet after game completion
export interface BetResult {
  betId: string;              // ID of the bet
  gameId: string;             // ID of the game
  winnerId?: string;          // ID of the winner (undefined for draw)
  loserId?: string;           // ID of the loser (undefined for draw)
  isDraw: boolean;            // Whether the game was a draw
  betType: BetType;           // Type of bet
  ratingChange?: number;      // Rating points transferred (for RATING_STAKE)
  profileControlExpiry?: Date; // When profile control expires (for PROFILE_CONTROL)
  profileLockExpiry?: Date;   // When profile lock expires (for PROFILE_LOCK)
}
