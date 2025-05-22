import { Injectable, Logger } from '@nestjs/common';
import { Chess, Color } from 'chess.js'; // We'll use chess.js for game logic

// Game end reasons
export enum GameEndReason {
  CHECKMATE = 'checkmate',
  STALEMATE = 'stalemate',
  THREEFOLD_REPETITION = 'threefold_repetition',
  INSUFFICIENT_MATERIAL = 'insufficient_material',
  FIFTY_MOVE_RULE = 'fifty_move_rule',
  TIMEOUT = 'timeout',
  RESIGNATION = 'resignation',
  DRAW_AGREEMENT = 'draw_agreement',
  ABANDON = 'abandon', // Player disconnects and doesn't come back
  ABORT = 'abort', // Before first move
}

// Game result
export enum GameResult {
  WHITE_WINS = 'white_wins',
  BLACK_WINS = 'black_wins',
  DRAW = 'draw',
  ABORTED = 'aborted',
}

// Game end details
export interface GameEndDetails {
  result: GameResult;
  reason: GameEndReason;
  winnerSocketId?: string; // Only set if there's a winner
  loserSocketId?: string; // Only set if there's a loser
}

// Piece definition
interface Piece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: 'w' | 'b';
}

@Injectable()
export class GameEndService {
  private readonly logger = new Logger(GameEndService.name);

  /**
   * Check if the game has ended and determine the result
   * @param chessInstance Chess.js instance representing the current game state
   * @param whitePlayerId Socket ID of the white player
   * @param blackPlayerId Socket ID of the black player
   * @param timeoutColor Color of the player who ran out of time (if applicable)
   * @param resigningColor Color of the resigning player (if applicable)
   * @param drawAgreement Whether a draw was agreed upon
   * @param disconnectedColor Color of the disconnected player (if applicable)
   * @param isFirstMove Whether the first move has been made
   * @param forceThreefoldCheck Whether to force check for threefold repetition (for client-reported cases)
   */
  checkGameEnd(
    chessInstance: Chess,
    whitePlayerId: string,
    blackPlayerId: string,
    timeoutColor?: Color,
    resigningColor?: Color,
    drawAgreement = false,
    disconnectedColor?: Color,
    isFirstMove = false,
    forceThreefoldCheck = false,
  ): GameEndDetails | null {
    // Check for timeout
    if (timeoutColor) {
      const hasWinnableMaterial = this.hasWinnableMaterial(chessInstance, timeoutColor === 'w' ? 'b' : 'w');
      
      if (hasWinnableMaterial) {
        return {
          result: timeoutColor === 'w' ? GameResult.BLACK_WINS : GameResult.WHITE_WINS,
          reason: GameEndReason.TIMEOUT,
          winnerSocketId: timeoutColor === 'w' ? blackPlayerId : whitePlayerId,
          loserSocketId: timeoutColor === 'w' ? whitePlayerId : blackPlayerId,
        };
      } else {
        // If opponent doesn't have winnable material, it's a draw
        return {
          result: GameResult.DRAW,
          reason: GameEndReason.TIMEOUT,
        };
      }
    }

    // Check for resignation
    if (resigningColor) {
      return {
        result: resigningColor === 'w' ? GameResult.BLACK_WINS : GameResult.WHITE_WINS,
        reason: GameEndReason.RESIGNATION,
        winnerSocketId: resigningColor === 'w' ? blackPlayerId : whitePlayerId,
        loserSocketId: resigningColor === 'w' ? whitePlayerId : blackPlayerId,
      };
    }

    // Check for draw agreement
    if (drawAgreement) {
      return {
        result: GameResult.DRAW,
        reason: GameEndReason.DRAW_AGREEMENT,
      };
    }

    // Check for disconnection/abandonment
    if (disconnectedColor) {
      // If first move hasn't been made, abort the game
      if (isFirstMove && disconnectedColor === 'w') {
        return {
          result: GameResult.ABORTED,
          reason: GameEndReason.ABORT,
        };
      }

      return {
        result: disconnectedColor === 'w' ? GameResult.BLACK_WINS : GameResult.WHITE_WINS,
        reason: GameEndReason.ABANDON,
        winnerSocketId: disconnectedColor === 'w' ? blackPlayerId : whitePlayerId,
        loserSocketId: disconnectedColor === 'w' ? whitePlayerId : blackPlayerId,
      };
    }

    // Check for checkmate
    if (chessInstance.isCheckmate()) {
      // In checkmate, the current turn indicates the player who lost
      const winner = chessInstance.turn() === 'w' ? 'b' : 'w';
      return {
        result: winner === 'w' ? GameResult.WHITE_WINS : GameResult.BLACK_WINS,
        reason: GameEndReason.CHECKMATE,
        winnerSocketId: winner === 'w' ? whitePlayerId : blackPlayerId,
        loserSocketId: winner === 'w' ? blackPlayerId : whitePlayerId,
      };
    }

    // Check for stalemate
    if (chessInstance.isStalemate()) {
      return {
        result: GameResult.DRAW,
        reason: GameEndReason.STALEMATE,
      };
    }

    // Check for threefold repetition
    if (chessInstance.isThreefoldRepetition() || forceThreefoldCheck) {
      // If forceThreefoldCheck is true, we trust the client's report of threefold repetition
      // This is needed because the client may detect it before the server does
      this.logger.log(`Threefold repetition detected: ${forceThreefoldCheck ? 'forced by client' : 'detected by server'}`);
      
      return {
        result: GameResult.DRAW,
        reason: GameEndReason.THREEFOLD_REPETITION,
      };
    }

    // Check for insufficient material
    if (chessInstance.isInsufficientMaterial()) {
      return {
        result: GameResult.DRAW,
        reason: GameEndReason.INSUFFICIENT_MATERIAL,
      };
    }

    // Check for fifty move rule
    if (chessInstance.isDraw()) {
      return {
        result: GameResult.DRAW,
        reason: GameEndReason.FIFTY_MOVE_RULE,
      };
    }

    // Game is still ongoing
    return null;
  }

  /**
   * Check if a player has winnable material 
   * (needed for determining timeout results)
   */
  private hasWinnableMaterial(chessInstance: Chess, color: Color): boolean {
    const board = chessInstance.board();
    const pieces: Piece[] = [];

    // Collect all pieces of the given color
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = board[row][col];
        if (square && square.color === (color === 'w' ? 'w' : 'b')) {
          pieces.push({
            type: square.type,
            color: square.color,
          });
        }
      }
    }

    // King only is not winnable
    if (pieces.length === 1) {
      return false;
    }

    // King and knight only is not winnable
    if (pieces.length === 2 && pieces.some(p => p.type === 'n')) {
      return false;
    }

    // King and bishop only is not winnable
    if (pieces.length === 2 && pieces.some(p => p.type === 'b')) {
      return false;
    }

    // King and two knights is technically not winnable, but we'll consider it winnable
    // in practical play since it can lead to mistakes by the opponent
    
    // Any other material combination is considered winnable
    return true;
  }
} 