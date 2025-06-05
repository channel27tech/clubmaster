// Defines the different types of bets available
export enum BetType {
  PROFILE_CONTROL = 'profile_control',
  PROFILE_LOCK = 'profile_lock',
  RATING_STAKE = 'rating_stake',
}

// Status of a bet challenge
export enum BetStatus {
  PENDING = 'pending',     // Challenge has been sent but not accepted
  ACCEPTED = 'accepted',   // Challenge has been accepted, game will start
  REJECTED = 'rejected',   // Challenge was rejected
  CANCELLED = 'cancelled', // Challenge was cancelled before response
  COMPLETED = 'completed', // Game has been played and bet resolved
  EXPIRED = 'expired',     // Challenge expired without response
}

// Represents a bet challenge
export interface BetChallenge {
  id: string;                 // Unique identifier for the bet
  challengerId: string;       // User ID of the challenger
  challengerName?: string;    // Name of the challenger
  challengerRating?: number;  // Rating of the challenger
  challengerPhotoURL?: string; // Profile photo URL of the challenger
  betType: BetType;           // Type of bet
  stakeAmount?: number;       // Amount of rating points at stake (for RATING_STAKE)
  gameMode: string;           // Game mode (Bullet, Blitz, Rapid)
  timeControl: string;        // Time control (e.g. "3+0", "5+0", "10+0")
  expiresAt: Date;            // When the bet challenge expires
  senderId?: string;          // User ID of the sender (same as challengerId, used for compatibility)
  senderUsername?: string;    // Username of the sender (same as challengerName, used for compatibility)
  senderPhotoURL?: string;    // Profile photo URL of the sender
  senderRating?: number;      // Rating of the sender
  preferredSide?: string;     // Preferred side (white, black, random)
  createdAt?: Date;           // When the bet challenge was created
  opponentId?: string;        // User ID of the opponent
  opponentSocketId?: string;  // Socket ID of the opponent
}

// Response to a bet challenge
export interface BetChallengeResponse {
  betId: string;            // ID of the bet challenge being responded to
  accepted: boolean;        // Whether the challenge was accepted
  responderId?: string;     // User ID of the responder
}

// Result of a bet after game completion
export interface BetResult {
  betId: string;              // ID of the bet
  gameId: string;             // ID of the game
  winnerId: string;           // ID of the winner (or null for draw)
  loserId?: string;           // ID of the loser (or null for draw)
  isDraw: boolean;            // Whether the game was a draw
  ratingChange?: number;      // Rating points transferred (for RATING_STAKE)
  profileControlExpiry?: Date; // When profile control expires (for PROFILE_CONTROL)
  profileLockExpiry?: Date;   // When profile lock expires (for PROFILE_LOCK)
} 