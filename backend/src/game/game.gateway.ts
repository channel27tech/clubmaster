import { SubscribeMessage, MessageBody, ConnectedSocket, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { GameEndService, GameEndReason, GameResult } from './game-end/game-end.service';
import { Color } from 'chess.js';

@WebSocketGateway()
export class GameGateway {
  private logger = new Logger(GameGateway.name);
  private games: Map<string, any> = new Map(); // Adjust type as per your game structure
  private gameEndService: GameEndService; // Inject this service properly in constructor if needed
  private server: any; // Adjust type as per your setup

  constructor(gameEndService: GameEndService) {
    this.gameEndService = gameEndService;
  }

  @SubscribeMessage('timeout_occurred')
  handleTimeoutOccurred(
    @MessageBody() data: { gameId: string; playerColor: 'white' | 'black' },
    @ConnectedSocket() client: Socket,
  ): void {
    this.logger.log(`Timeout occurred in game ${data.gameId} for ${data.playerColor}`);

    const game = this.games.get(data.gameId);
    if (!game) {
      this.logger.error(`Game ${data.gameId} not found for timeout`);
      return;
    }

    // Determine winner and loser based on the player who timed out
    const timeoutColor = data.playerColor === 'white' ? 'w' : 'b';
    const gameEndDetails = this.gameEndService.checkGameEnd(
      game.chess,
      game.whitePlayerId,
      game.blackPlayerId,
      timeoutColor as Color,
    );

    if (gameEndDetails) {
      this.logger.log(`Game ${data.gameId} ended due to timeout`);
      // Emit game_end event to all clients in the room with winner and loser colors
      this.server.to(data.gameId).emit('game_end', {
        reason: GameEndReason.TIMEOUT,
        result: gameEndDetails.result,
        winnerSocketId: gameEndDetails.winnerSocketId,
        loserSocketId: gameEndDetails.loserSocketId,
        winnerColor: gameEndDetails.result === GameResult.WHITE_WINS ? 'white' : (gameEndDetails.result === GameResult.BLACK_WINS ? 'black' : undefined),
        loserColor: gameEndDetails.result === GameResult.WHITE_WINS ? 'black' : (gameEndDetails.result === GameResult.BLACK_WINS ? 'white' : undefined),
      });

      // Update game state
      game.isGameOver = true;
      this.games.set(data.gameId, game);
    } else {
      this.logger.error(`Failed to determine game end details for timeout in game ${data.gameId}`);
    }
  }
}