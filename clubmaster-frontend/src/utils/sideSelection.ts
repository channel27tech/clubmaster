/**
 * Side selection utility for chess matchmaking
 */

// Define the possible side preferences a player can select
export type SidePreference = 'white' | 'black' | 'random';

/**
 * Server-assigned color type
 */
export type PlayerColor = 'white' | 'black';

/**
 * Test utility to verify side selection logic serverside (admin use)
 * 
 * @param player1Preference - Player 1's side preference
 * @param player2Preference - Player 2's side preference
 * @param gameId - Game ID to use for consistency
 * @returns Analysis of the expected outcome
 */
export function analyzeSideAssignment(
  player1Preference: SidePreference,
  player2Preference: SidePreference,
  gameId: string
): string {
  // Hash function for deterministic decisions
  const deterministicRandom = (id: string): boolean => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 2) === 0; 
  };

  // Determine the outcome based on the preferences
  let player1Color: PlayerColor;
  let player2Color: PlayerColor;
  let explanation: string;

  // CASE 1: One chooses White, one chooses Black
  if (player1Preference === 'white' && player2Preference === 'black') {
    player1Color = 'white';
    player2Color = 'black';
    explanation = 'Player1 chose White, Player2 chose Black - assigned accordingly';
  }
  else if (player1Preference === 'black' && player2Preference === 'white') {
    player1Color = 'black';
    player2Color = 'white';
    explanation = 'Player1 chose Black, Player2 chose White - assigned accordingly';
  }
  // CASE 2: One chooses White/Black, other chooses Random
  else if (player1Preference === 'white' && player2Preference === 'random') {
    player1Color = 'white';
    player2Color = 'black';
    explanation = 'Player1 chose White, Player2 chose Random - P1 gets White, P2 gets Black';
  }
  else if (player1Preference === 'black' && player2Preference === 'random') {
    player1Color = 'black';
    player2Color = 'white';
    explanation = 'Player1 chose Black, Player2 chose Random - P1 gets Black, P2 gets White';
  }
  else if (player1Preference === 'random' && player2Preference === 'white') {
    player1Color = 'black';
    player2Color = 'white';
    explanation = 'Player1 chose Random, Player2 chose White - P1 gets Black, P2 gets White';
  }
  else if (player1Preference === 'random' && player2Preference === 'black') {
    player1Color = 'white';
    player2Color = 'black';
    explanation = 'Player1 chose Random, Player2 chose Black - P1 gets White, P2 gets Black';
  }
  // CASE 3: Both choose Random
  else if (player1Preference === 'random' && player2Preference === 'random') {
    const player1GetsWhite = deterministicRandom(gameId);
    player1Color = player1GetsWhite ? 'white' : 'black';
    player2Color = player1GetsWhite ? 'black' : 'white';
    explanation = `Both chose Random - Used gameId for random assignment: Player1 gets ${player1Color}`;
  }
  // CASE 4: Both choose the same side
  else if (player1Preference === 'white' && player2Preference === 'white') {
    const player1GetsWhite = deterministicRandom(gameId);
    player1Color = player1GetsWhite ? 'white' : 'black';
    player2Color = player1GetsWhite ? 'black' : 'white';
    explanation = `Both chose White - Random assignment: Player1 gets ${player1Color}`;
  }
  else if (player1Preference === 'black' && player2Preference === 'black') {
    const player1GetsBlack = deterministicRandom(gameId);
    player1Color = player1GetsBlack ? 'black' : 'white';
    player2Color = player1GetsBlack ? 'white' : 'black';
    explanation = `Both chose Black - Random assignment: Player1 gets ${player1Color}`;
  }
  else {
    player1Color = 'white';
    player2Color = 'black';
    explanation = 'Fallback case - Player1 gets white by default';
  }

  // Validate the result - make sure we have one white and one black
  const valid = (player1Color === 'white' && player2Color === 'black') || 
                (player1Color === 'black' && player2Color === 'white');

  return `
  Player1: ${player1Preference} → ${player1Color}
  Player2: ${player2Preference} → ${player2Color}
  Game ID: ${gameId}
  Result: ${valid ? '✓ VALID' : '❌ INVALID'} 
  Explanation: ${explanation}
  `;
}

/**
 * Demo function to test the side selection logic with all combinations
 */
export function testAllCombinations(): void {
  const preferences: SidePreference[] = ['white', 'black', 'random'];
  const gameId = `game_${Date.now()}`;
  
  console.log('--------- SIDE SELECTION LOGIC TEST ---------');
  console.log(`Using game ID: ${gameId}`);
  console.log('--------------------------------------------');
  
  // Test all combinations
  for (const p1Pref of preferences) {
    for (const p2Pref of preferences) {
      console.log(`CASE: Player1(${p1Pref}) vs Player2(${p2Pref})`);
      console.log(analyzeSideAssignment(p1Pref, p2Pref, gameId));
      console.log('--------------------------------------------');
    }
  }
} 