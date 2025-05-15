/**
 * Side selection utility for chess matchmaking
 * Implements the logic for determining player colors based on preferences
 */

export type SidePreference = 'white' | 'black' | 'random';

interface PlayerPreferences {
  player1Side: SidePreference;
  player2Side: SidePreference;
}

interface SideSelectionResult {
  player1Color: 'white' | 'black';
  player2Color: 'white' | 'black';
}

/**
 * Generates a deterministic random boolean based on game ID
 * This ensures both clients get the same "random" result
 * @param gameId - Unique game identifier
 * @returns A boolean value that will be consistent for the same gameId
 */
export function deterministicRandom(gameId: string): boolean {
  // Simple hash function to generate a number from the gameId string
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) - hash) + gameId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Use the hash to generate a boolean (even/odd)
  return (Math.abs(hash) % 2) === 0;
}

/**
 * Determines player colors based on their preferences
 * @param preferences - Both players' side preferences
 * @param gameId - Unique game identifier for deterministic randomness
 * @returns Object with assigned colors for both players
 */
export function determineSides(
  preferences: PlayerPreferences,
  gameId: string
): SideSelectionResult {
  const { player1Side, player2Side } = preferences;
  
  // Case 1: If one player selects White and the other Black, assign accordingly
  if (player1Side === 'white' && player2Side === 'black') {
    return { player1Color: 'white', player2Color: 'black' };
  }
  if (player1Side === 'black' && player2Side === 'white') {
    return { player1Color: 'black', player2Color: 'white' };
  }
  
  // Case 2: If one selects White or Black, and the other selects Random
  if (player1Side === 'white' && player2Side === 'random') {
    return { player1Color: 'white', player2Color: 'black' };
  }
  if (player1Side === 'black' && player2Side === 'random') {
    return { player1Color: 'black', player2Color: 'white' };
  }
  if (player1Side === 'random' && player2Side === 'white') {
    return { player1Color: 'black', player2Color: 'white' };
  }
  if (player1Side === 'random' && player2Side === 'black') {
    return { player1Color: 'white', player2Color: 'black' };
  }
  
  // Case 3: If both select the same side (both want White or both want Black)
  if (player1Side === 'white' && player2Side === 'white') {
    // Randomly assign one to White and the other to Black
    const player1GetsWhite = deterministicRandom(gameId);
    return player1GetsWhite 
      ? { player1Color: 'white', player2Color: 'black' }
      : { player1Color: 'black', player2Color: 'white' };
  }
  if (player1Side === 'black' && player2Side === 'black') {
    // Randomly assign one to Black and the other to White
    const player1GetsBlack = deterministicRandom(gameId);
    return player1GetsBlack 
      ? { player1Color: 'black', player2Color: 'white' }
      : { player1Color: 'white', player2Color: 'black' };
  }
  
  // Case 4: If both select Random
  if (player1Side === 'random' && player2Side === 'random') {
    // Randomly assign colors
    const player1GetsWhite = deterministicRandom(gameId);
    return player1GetsWhite 
      ? { player1Color: 'white', player2Color: 'black' }
      : { player1Color: 'black', player2Color: 'white' };
  }
  
  // Default fallback (should never reach here if all cases are covered)
  const fallbackRandom = deterministicRandom(gameId);
  return fallbackRandom
    ? { player1Color: 'white', player2Color: 'black' }
    : { player1Color: 'black', player2Color: 'white' };
}

/**
 * Determines the local player's color based on preferences and game ID
 * @param localPreference - Local player's side preference
 * @param remotePreference - Remote player's side preference
 * @param gameId - Unique game identifier
 * @param isPlayer1 - Whether the local player is player1 in the game
 * @returns The assigned color for the local player
 */
export function determineLocalPlayerColor(
  localPreference: SidePreference,
  remotePreference: SidePreference,
  gameId: string,
  isPlayer1: boolean
): 'white' | 'black' {
  console.log('determineLocalPlayerColor - inputs:', {
    localPreference,
    remotePreference,
    gameId,
    isPlayer1
  });

  const preferences = isPlayer1
    ? { player1Side: localPreference, player2Side: remotePreference }
    : { player1Side: remotePreference, player2Side: localPreference };
    
  const result = determineSides(preferences, gameId);
  
  // Log the result of the side selection
  console.log('determineLocalPlayerColor - result:', result);
  console.log(`determineLocalPlayerColor - assigned color: ${isPlayer1 ? result.player1Color : result.player2Color}`);
  
  return isPlayer1 ? result.player1Color : result.player2Color;
}

/**
 * A testing/debugging function that simulates side selection for both players
 * This can be used to verify that both players will reach the same conclusion
 * @param player1Preference - Player 1's side preference
 * @param player2Preference - Player 2's side preference
 * @param gameId - Unique game identifier
 * @returns Object with the results of both players' calculations
 */
export function verifySideAgreement(
  player1Preference: SidePreference,
  player2Preference: SidePreference,
  gameId: string
): { player1Result: string, player2Result: string } {
  // What player1 will calculate (player1 is true for isPlayer1)
  const player1Color = determineLocalPlayerColor(
    player1Preference, 
    player2Preference, 
    gameId, 
    true
  );
  
  // What player2 will calculate (player2 is false for isPlayer1)
  const player2Color = determineLocalPlayerColor(
    player2Preference, 
    player1Preference, 
    gameId, 
    false
  );
  
  // Check if they agree (one white, one black)
  const agreementValid = 
    (player1Color === 'white' && player2Color === 'black') || 
    (player1Color === 'black' && player2Color === 'white');
  
  // Return the results
  return {
    player1Result: `Player1 will play as ${player1Color}`,
    player2Result: `Player2 will play as ${player2Color}`,
    agreement: agreementValid ? 'VALID ✅' : 'ERROR - INCONSISTENT RESULTS ❌'
  };
}

/**
 * Test function to verify that the deterministic random function always returns
 * the same value for a given game ID
 * @param gameId - The game ID to test
 * @param iterations - Number of test iterations to run
 * @returns Verification results
 */
export function testDeterministicRandomConsistency(
  gameId: string,
  iterations: number = 10
): { consistent: boolean, results: boolean[] } {
  const results: boolean[] = [];
  
  // Get the first result
  const firstResult = deterministicRandom(gameId);
  results.push(firstResult);
  
  // Run multiple iterations to verify consistency
  for (let i = 1; i < iterations; i++) {
    const result = deterministicRandom(gameId);
    results.push(result);
    
    // If any result differs, the function is not consistent
    if (result !== firstResult) {
      return { consistent: false, results };
    }
  }
  
  return { consistent: true, results };
}

/**
 * Test function specifically for the case when both players select the same side
 * @param sidePreference - The side both players selected ('white' or 'black')
 * @param gameId - The game ID to use for deterministic random assignment
 * @returns The results of the side assignment
 */
export function testBothPlayersSameSide(
  sidePreference: 'white' | 'black',
  gameId: string
): {
  gameId: string,
  sidePreference: string,
  player1Result: string,
  player2Result: string,
  bothAssignedSame: boolean,
  correctlyHandled: boolean
} {
  const player1Preference = sidePreference;
  const player2Preference = sidePreference;
  
  // What player1 thinks their color should be
  const player1Color = determineLocalPlayerColor(
    player1Preference, 
    player2Preference,
    gameId, 
    true
  );
  
  // What player2 thinks their color should be
  const player2Color = determineLocalPlayerColor(
    player2Preference, 
    player1Preference, 
    gameId, 
    false
  );
  
  // Check if they agree (one white, one black)
  const bothAssignedSame = player1Color === player2Color;
  
  // Are we handling the case correctly?
  const correctlyHandled = !bothAssignedSame;
  
  return {
    gameId,
    sidePreference,
    player1Result: `Player1 will play as ${player1Color}`,
    player2Result: `Player2 will play as ${player2Color}`,
    bothAssignedSame,
    correctlyHandled
  };
} 