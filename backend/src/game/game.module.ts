import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { GameEndService } from './game-end/game-end.service';
import { RatingService } from './rating/rating.service';
import { GameManagerService } from './game-manager.service';
<<<<<<< HEAD
import { DisconnectionService } from './disconnection.service';
import { TimerModule } from './timer/timer.module';

@Module({
  imports: [TimerModule],
=======

@Module({
>>>>>>> main
  providers: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
<<<<<<< HEAD
    DisconnectionService,
=======
>>>>>>> main
  ],
  exports: [
    MatchmakingService,
    GameEndService,
    RatingService,
    GameManagerService,
<<<<<<< HEAD
    DisconnectionService,
=======
>>>>>>> main
  ],
})
export class GameModule {} 