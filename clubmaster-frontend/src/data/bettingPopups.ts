export interface BettingPopup {
  title: string;
  description: string;
  points: string[];
}

export const bettingPopups: BettingPopup[] = [
  {
    title: "Temporary profile control",
    description: "Win the game to gain temporary control over your opponent's profile for 24 hours.",
    points: [
      "What You Can Do:",
      "Change Display Name: Choose from 6 predefined nicknames to update your opponent's display name.",
      "Change Profile Picture: Select from 4 predefined avatars to change their profile picture.",
      "Duration:",
      "All changes are temporary and will automatically revert back to the original after 24 hours.",
      "Conditions:",
      "If You Win: You gain control over your opponent's profile as described.",
      "If You Lose: Your opponent gains control over your profile with the same options.",
      "If the Game is a Draw: No profile changes are made; both profiles remain unchanged.",
    ],
  },
  {
    title: "Temporary profile lock",
    description: "Win the game to gain temporary control over your opponent's profile for 24 hours.",
    points: [
      "What You Can Do:",
      "Change Display Name: Choose from 6 predefined nicknames to update your opponent's display name.",
      "Change Profile Picture: Select from 4 predefined avatars to change their profile picture.",
      "Duration:",
      "All changes are temporary and will automatically revert back to the original after 24 hours.",
      "Conditions:",
      "If You Win: You gain control over your opponent's profile as described.",
      "If You Lose: Your opponent gains control over your profile with the same options.",
      "If the Game is a Draw: No profile changes are made; both profiles remain unchanged.",
    ],
  },
  {
    title: "Rating Stakes",
    description: "Win the game to gain temporary control over your opponent's profile for 24 hours.",
    points: [
      "What Happens:",
      "Reduce Opponent's Rating: Deduct the agreed-upon rating points from your opponent's total rating (default: 200 points, customizable).",
      "Standard Rating Gain: You only receive the standard rating increase for a normal game win.",
      "Duration:",
      "The rating deduction is applied immediately after the game ends and is reflected in the leaderboard rankings.",
      "Conditions:",
      "If You Win: Your opponent's rating decreases by the agreed points, and you gain the standard game rating increase.",
      "If You Lose: Your rating decreases by the agreed points..",
      "If the Game is a Draw: No changes are made to either player's rating; both remain unchanged.",
    ],
  },
]; 