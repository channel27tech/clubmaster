import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { GameEndService } from './game-end/game-end.service';
import { RatingService } from './rating/rating.service';
import { GameManagerService } from './game-manager.service';

@Module({
  providers: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
  ],
  exports: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
  ],
})
export class GameModule {} 