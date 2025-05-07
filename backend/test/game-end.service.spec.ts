import { Test, TestingModule } from '@nestjs/testing';
import { GameEndService, GameEndReason, GameResult } from '../src/game/game-end/game-end.service';
import { Chess } from 'chess.js';

describe('GameEndService', () => {
  let service: GameEndService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameEndService],
    }).compile();

    service = module.get<GameEndService>(GameEndService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Helper function to make multiple moves at once
  const makeMoves = (chess: Chess, moves: string[]) => {
    moves.forEach(move => {
      chess.move(move);
    });
  };

  describe('checkmate detection', () => {
    it('should detect checkmate correctly - Scholar\'s mate', () => {
      const chess = new Chess();
      // Scholar's mate sequence
      makeMoves(chess, ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.CHECKMATE);
      expect(result?.result).toBe(GameResult.WHITE_WINS);
      expect(result?.winnerSocketId).toBe('whitePlayerId');
      expect(result?.loserSocketId).toBe('blackPlayerId');
    });

    it('should detect checkmate correctly - Fool\'s mate', () => {
      const chess = new Chess();
      // Fool's mate sequence
      makeMoves(chess, ['f3', 'e5', 'g4', 'Qh4#']);
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.CHECKMATE);
      expect(result?.result).toBe(GameResult.BLACK_WINS);
      expect(result?.winnerSocketId).toBe('blackPlayerId');
      expect(result?.loserSocketId).toBe('whitePlayerId');
    });
  });

  describe('stalemate detection', () => {
    it('should detect stalemate correctly', () => {
      const chess = new Chess();
      // A stalemate position
      makeMoves(chess, [
        'e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 
        'Qxc7', 'f6', 'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 
        'Qxc8', 'Kg6', 'Qe6'
      ]);
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.STALEMATE);
      expect(result?.result).toBe(GameResult.DRAW);
    });
  });

  describe('insufficient material detection', () => {
    it('should detect insufficient material (K vs K)', () => {
      const chess = new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.INSUFFICIENT_MATERIAL);
      expect(result?.result).toBe(GameResult.DRAW);
    });

    it('should detect insufficient material (K+B vs K)', () => {
      const chess = new Chess('8/8/8/4k3/8/8/1B6/4K3 w - - 0 1');
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.INSUFFICIENT_MATERIAL);
      expect(result?.result).toBe(GameResult.DRAW);
    });

    it('should detect insufficient material (K+N vs K)', () => {
      const chess = new Chess('8/8/8/4k3/8/8/1N6/4K3 w - - 0 1');
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.INSUFFICIENT_MATERIAL);
      expect(result?.result).toBe(GameResult.DRAW);
    });
  });

  describe('threefold repetition detection', () => {
    it('should detect threefold repetition', () => {
      const chess = new Chess();
      // Create a threefold repetition
      makeMoves(chess, [
        'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8',
        'Nf3', 'Nf6' // Third occurrence
      ]);
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.THREEFOLD_REPETITION);
      expect(result?.result).toBe(GameResult.DRAW);
    });
  });

  describe('resignation detection', () => {
    it('should handle white resignation correctly', () => {
      const chess = new Chess();
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        undefined, // No timeout
        'w' // White resigns
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.RESIGNATION);
      expect(result?.result).toBe(GameResult.BLACK_WINS);
      expect(result?.winnerSocketId).toBe('blackPlayerId');
      expect(result?.loserSocketId).toBe('whitePlayerId');
    });

    it('should handle black resignation correctly', () => {
      const chess = new Chess();
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        undefined, // No timeout
        'b' // Black resigns
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.RESIGNATION);
      expect(result?.result).toBe(GameResult.WHITE_WINS);
      expect(result?.winnerSocketId).toBe('whitePlayerId');
      expect(result?.loserSocketId).toBe('blackPlayerId');
    });
  });

  describe('timeout detection', () => {
    it('should handle white timeout with black having winnable material', () => {
      const chess = new Chess();
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        'w', // White timeout
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.TIMEOUT);
      expect(result?.result).toBe(GameResult.BLACK_WINS);
      expect(result?.winnerSocketId).toBe('blackPlayerId');
      expect(result?.loserSocketId).toBe('whitePlayerId');
    });

    it('should handle timeout as draw with insufficient material', () => {
      const chess = new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1'); // K vs K
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        'w', // White timeout
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.TIMEOUT);
      expect(result?.result).toBe(GameResult.DRAW);
    });
  });

  describe('draw agreement detection', () => {
    it('should handle draw by agreement', () => {
      const chess = new Chess();
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        undefined, // No timeout
        undefined, // No resignation
        true // Draw agreement
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.DRAW_AGREEMENT);
      expect(result?.result).toBe(GameResult.DRAW);
    });
  });

  describe('abandonment detection', () => {
    it('should handle white player abandonment', () => {
      const chess = new Chess();
      // Make one move so it's not an aborted game
      chess.move('e4');
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        undefined, // No timeout
        undefined, // No resignation
        false, // No draw agreement
        'w', // White player disconnected
        false // Not the first move
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.ABANDON);
      expect(result?.result).toBe(GameResult.BLACK_WINS);
    });

    it('should abort the game if white disconnects before first move', () => {
      const chess = new Chess();
      
      const result = service.checkGameEnd(
        chess,
        'whitePlayerId',
        'blackPlayerId',
        undefined, // No timeout
        undefined, // No resignation
        false, // No draw agreement
        'w', // White player disconnected
        true // It is the first move
      );
      
      expect(result).toBeDefined();
      expect(result?.reason).toBe(GameEndReason.ABORT);
      expect(result?.result).toBe(GameResult.ABORTED);
    });
  });
}); 