// Remove all bet result saving, retrieval, and enhancement logic

// Define a type for enhanced game results with bet information
export interface BetGameResult {
  result: GameResultType;
  reason: GameEndReason;
  playerName: string;
  opponentName: string;
  playerRating: number;
  opponentRating: number;
  playerRatingChange: number;
  opponentRatingChange: number;
  playerPhotoURL?: string | null;
  opponentPhotoURL?: string | null;
  betType?: BetType;
  isBetGameWinner?: boolean;
  opponentNameForBetContext?: string;
  opponentIdForBetContext?: string;
}

// Define a base type for game results
export interface BaseGameResult {
  result: GameResultType;
  reason: GameEndReason;
  playerName: string;
  opponentName: string;
  playerRating: number;
  opponentRating: number;
  playerRatingChange: number;
  opponentRatingChange: number;
  playerPhotoURL?: string | null;
  opponentPhotoURL?: string | null;
}

// Define a type for bet results
export interface BetResultData {
  betType: BetType;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  gameId?: string;
  timestamp?: number;
  stakeAmount?: number;
}

/**
 * Enhances game result data with bet information
 */
export function enhanceWithBetResult(
  gameResult: BaseGameResult, 
  betResult: BetResultData | null,
  socketId?: string
): BetGameResult & { opponentNameForBetMessage?: string; stakeAmount?: number } {
  // If there's no bet result, return the original game result
  if (!betResult) {
    return gameResult;
  }
  
  // Determine if the current player is the bet winner
  const isBetGameWinner = socketId ? 
    socketId === betResult.winnerId : 
    gameResult.result === 'win';
  
  // Determine opponent name for bet message
  const opponentNameForBetMessage = isBetGameWinner ? betResult.loserName : betResult.winnerName;
  
  // Return enhanced game result with bet information
  return {
    ...gameResult,
    betType: betResult.betType,
    isBetGameWinner,
    opponentNameForBetContext: isBetGameWinner ? 
      betResult.loserName : betResult.winnerName,
    opponentIdForBetContext: isBetGameWinner ? 
      betResult.loserId : betResult.winnerId,
    opponentNameForBetMessage,
    stakeAmount: (typeof betResult.stakeAmount === 'number') ? betResult.stakeAmount : undefined,
  };
}

// Store bet results in memory to ensure they're available across components
const cachedBetResults: Record<string, BetResultData> = {};

// Save bet result for a specific game
export function saveBetResult(gameId: string, betResult: BetResultData): void {
  cachedBetResults[gameId] = betResult;
  
  // Also save to localStorage as backup
  try {
    localStorage.setItem(`bet_result_${gameId}`, JSON.stringify(betResult));
  } catch (error) {
    // (Remove all lines with console.error)
  }
  
  // Dispatch an event to notify components
  window.dispatchEvent(new CustomEvent('bet_result_updated', { 
    detail: { gameId, betType: betResult.betType }
  }));
}

// Get bet result for a specific game
export function getBetResult(gameId: string): BetResultData | null {
  // First try memory cache
  if (cachedBetResults[gameId]) {
    return cachedBetResults[gameId];
  }
  
  // Then try localStorage
  try {
    const savedResult = localStorage.getItem(`bet_result_${gameId}`);
    if (savedResult) {
      const parsedResult = JSON.parse(savedResult) as BetResultData;
      cachedBetResults[gameId] = parsedResult; // Update cache
      return parsedResult;
    }
  } catch (error) {
    // (Remove all lines with console.error)
  }
  
  return null;
}

// Clear bet result for a specific game
export function clearBetResult(gameId: string): void {
  delete cachedBetResults[gameId];
  try {
    localStorage.removeItem(`bet_result_${gameId}`);
  } catch (error) {
    // (Remove all lines with console.error)
  }
} 