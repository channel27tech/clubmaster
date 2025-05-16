import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';

@Injectable()
export class GameRepositoryService {
  private readonly logger = new Logger(GameRepositoryService.name);

  constructor(
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
  ) {}

  async findAll(): Promise<Game[]> {
    return this.gamesRepository.find();
  }

  async findRecentGames(limit: number = 10): Promise<Game[]> {
    return this.gamesRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<Game | null> {
    return this.gamesRepository.findOne({
      where: { id },
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  async create(gameData: Partial<Game>): Promise<Game> {
    const game = this.gamesRepository.create(gameData);
    return this.gamesRepository.save(game);
  }

  async update(id: string, gameData: Partial<Game>): Promise<Game | null> {
    await this.gamesRepository.update(id, gameData);
    return this.findOne(id);
  }

  async endGame(
    id: string,
    status: 'white_win' | 'black_win' | 'draw' | 'aborted',
    endReason: string,
    pgn?: string,
  ): Promise<Game | null> {
    const updateData: Partial<Game> = {
      status,
      endReason,
    };

    if (pgn) {
      updateData.pgn = pgn;
    }

    if (status === 'white_win') {
      // Get the game to set the winnerId
      const game = await this.findOne(id);
      if (game) {
        updateData.winnerId = game.whitePlayerId;
      }
    } else if (status === 'black_win') {
      const game = await this.findOne(id);
      if (game) {
        updateData.winnerId = game.blackPlayerId;
      }
    }

    await this.gamesRepository.update(id, updateData);
    return this.findOne(id);
  }

  async addMove(id: string, move: any): Promise<Game | null> {
    const game = await this.findOne(id);
    if (!game) {
      return null;
    }

    if (!game.moves) {
      game.moves = [];
    }

    game.moves.push(move);
    game.totalMoves = game.moves.length;

    return this.gamesRepository.save(game);
  }

  async findPlayerGames(playerId: string, limit: number = 10): Promise<Game[]> {
    return this.gamesRepository.find({
      where: [
        { whitePlayerId: playerId },
        { blackPlayerId: playerId },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  async getGameStats(playerId: string): Promise<{
    total: number;
    wins: number;
    losses: number;
    draws: number;
  }> {
    // Get all games where the player was white
    const whiteGames = await this.gamesRepository.find({
      where: { whitePlayerId: playerId },
    });

    // Get all games where the player was black
    const blackGames = await this.gamesRepository.find({
      where: { blackPlayerId: playerId },
    });

    const games = [...whiteGames, ...blackGames];

    const stats = {
      total: games.length,
      wins: 0,
      losses: 0,
      draws: 0,
    };

    for (const game of games) {
      if (game.status === 'draw') {
        stats.draws++;
      } else if (
        (game.status === 'white_win' && game.whitePlayerId === playerId) ||
        (game.status === 'black_win' && game.blackPlayerId === playerId)
      ) {
        stats.wins++;
      } else if (
        (game.status === 'white_win' && game.blackPlayerId === playerId) ||
        (game.status === 'black_win' && game.whitePlayerId === playerId)
      ) {
        stats.losses++;
      }
    }

    return stats;
  }
} 