# Bet Result Components

This directory contains components for displaying bet game results based on the type of bet:

1. **BetResultScreen** - Base component for all bet result screens
2. **ProfileControlResult** - For profile control bet results
3. **ProfileLockResult** - For profile lock bet results
4. **RatingStakeResult** - For rating stake bet results

## Usage

The components are designed to be used in place of the standard GameResultScreen for bet games. They handle displaying the appropriate content based on the bet type and result.

```tsx
import { 
  ProfileControlResult, 
  ProfileLockResult, 
  RatingStakeResult 
} from './bet-results';

// In your component:
const renderBetResult = () => {
  // Based on bet type
  switch (betType) {
    case 'profile_control':
      return (
        <ProfileControlResult
          result={result} // 'win' | 'loss' | 'draw'
          playerName="Player Name"
          opponentName="Opponent Name"
          playerRating={1500}
          ratingChange={10}
          playerAvatar="/path/to/avatar.jpg"
          opponentAvatar="/path/to/opponent-avatar.jpg"
          opponentId="opponent-user-id"
          controlDurationHours={24}
          onRematch={handleRematch}
        />
      );
      
    case 'profile_lock':
      return (
        <ProfileLockResult
          result={result}
          playerName="Player Name"
          opponentName="Opponent Name"
          playerRating={1500}
          ratingChange={10}
          playerAvatar="/path/to/avatar.jpg"
          opponentAvatar="/path/to/opponent-avatar.jpg"
          opponentId="opponent-user-id"
          lockDurationHours={24}
          onRematch={handleRematch}
        />
      );
      
    case 'rating_stake':
      return (
        <RatingStakeResult
          result={result}
          playerName="Player Name"
          opponentName="Opponent Name"
          playerRating={1500}
          ratingChange={10}
          playerAvatar="/path/to/avatar.jpg"
          opponentAvatar="/path/to/opponent-avatar.jpg"
          opponentId="opponent-user-id"
          stakeAmount={10}
          onRematch={handleRematch}
        />
      );
      
    default:
      return <GameResultScreen {...gameResultData} />;
  }
};
```

## Integration with ChessBoardWrapper

These components have been integrated with ChessBoardWrapper.tsx to handle bet game results. The workflow is:

1. ChessBoardWrapper detects game end from socket events
2. For bet games, it processes the bet result data
3. It selects the appropriate result component based on bet type
4. It renders the result component with the necessary data

The helper `betResultHelper.ts` is used to process the result data and ensure it has the correct types.

## Styling

The components are styled with Tailwind CSS to match the provided design. The main elements are:

- Green header for winners, red header for losers
- Player avatars with scores
- Rating display with changes
- Bet-specific message
- Rematch button
- Action buttons (Share, Back to home)

## Component Structure

Each specialized component follows the same pattern:
1. It receives props specific to that bet type
2. It wraps the base BetResultScreen component
3. It provides bet-specific content through the children prop

This approach allows for consistent styling across all bet types while allowing for custom content. 