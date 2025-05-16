import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchmakingService } from './matchmaking.service';
import { GameEndService } from './game-end/game-end.service';
import { RatingService } from './rating/rating.service';
import { GameManagerService } from './game-manager.service';
import { DisconnectionService } from './disconnection.service';
import { TimerModule } from './timer/timer.module';
import { Game } from './entities/game.entity';
import { GameRepositoryService } from './game-repository.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TimerModule,
    TypeOrmModule.forFeature([Game]),
    UsersModule,
  ],
  providers: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
    DisconnectionService,
    GameRepositoryService,
  ],
  exports: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
    DisconnectionService,
    GameRepositoryService,
  ],
})
export class GameModule {} 
