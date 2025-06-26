'use client';

import { BetType } from '@/types/bet';
import { GameResultType, GameEndReason } from './types';

// Result data type
export interface BetResultData {
  result: GameResultType;
  reason: GameEndReason;
  playerName: string;
  opponentName: string;
  playerRating: number;
  opponentRating: number;
  playerPhotoURL: string | null;
  opponentPhotoURL: string | null;
  playerRatingChange: number;
  opponentRatingChange: number;
  betType?: BetType;
  isBetWinner?: boolean;
  opponentIdForBetContext?: string;
  winnerId?: string;
  loserId?: string;
}

// Ensure all properties have valid values with fallbacks
export function processResultData(data: any): BetResultData {
  return {
    result: data?.result || 'draw',
    reason: data?.reason || 'unknown',
    playerName: data?.playerName || 'Player',
    opponentName: data?.opponentName || 'Opponent',
    playerRating: typeof data?.playerRating === 'number' ? data.playerRating : 1500,
    opponentRating: typeof data?.opponentRating === 'number' ? data.opponentRating : 1500,
    playerPhotoURL: data?.playerPhotoURL || null,
    opponentPhotoURL: data?.opponentPhotoURL || null,
    playerRatingChange: typeof data?.playerRatingChange === 'number' ? data.playerRatingChange : 0,
    opponentRatingChange: typeof data?.opponentRatingChange === 'number' ? data.opponentRatingChange : 0,
    betType: data?.betType,
    isBetWinner: !!data?.isBetWinner,
    opponentIdForBetContext: data?.opponentIdForBetContext || '',
    winnerId: data?.winnerId,
    loserId: data?.loserId
  };
}

export function getBetResultComponentProps(data: BetResultData) {
  return {
    result: data.result,
    playerName: data.playerName,
    opponentName: data.opponentName,
    playerRating: data.playerRating,
    ratingChange: data.playerRatingChange,
    playerAvatar: data.playerPhotoURL,
    opponentAvatar: data.opponentPhotoURL,
    opponentId: data.opponentIdForBetContext || '',
    betType: data.betType
  };
} 