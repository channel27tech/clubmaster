# Chess Application Routing Structure

This document outlines the routing structure for the Clubmaster Chess application.

## Base Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage/Landing page (placeholder for now) |
| `/play` | Match setup screen, also shows waiting screen after clicking "Play Random" |

## Game Routes

Games are organized using the following pattern:
```
/[gameType]/game/[gameId]
```

Where `[gameType]` represents the type of game:
- `play` - Standard random games
- `tournament` - Tournament games (future)
- `bet` - Bet-based games (future)

And `[gameId]` is the unique identifier for each game.

| Route | Description |
|-------|-------------|
| `/play/game/[gameId]` | The game screen for standard games |
| `/play/game/[gameId]/result` | Game result screen showing outcome |

## Redirects

For backward compatibility, the following redirects are in place:
- `/game/[gameId]` → `/play/game/[gameId]`

## Future Routes

As the application grows, additional routes will be added following this pattern:

| Route | Description |
|-------|-------------|
| `/tournament/game/[gameId]` | Tournament game screen |
| `/tournament/game/[gameId]/result` | Tournament game result |
| `/bet/game/[gameId]` | Bet-based game screen |
| `/bet/game/[gameId]/result` | Bet-based game result |
| `/profile` | User profile |
| `/profile/history` | Game history |
| `/profile/stats` | User statistics |

This structured approach ensures that the routing is scalable, maintainable, and provides clear context for each game type. 