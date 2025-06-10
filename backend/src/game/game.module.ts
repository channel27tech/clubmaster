import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameManagerService } from './game-manager.service';
import { GameRepositoryService } from './game-repository.service';
import { GameEndService } from './game-end/game-end.service';
import { RatingService } from './rating/rating.service';
import { MatchmakingService } from './matchmaking.service';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { UsersModule } from '../users/users.module';
import { BetModule } from '../bet/bet.module';
import { DisconnectionService } from './disconnection.service';
import { GameNotificationHelper } from './game-notification.helper';
import { TournamentNotificationHelper } from './tournament-notification.helper';
import { NotificationsModule } from '../notifications/notifications.module';
import { Game } from './entities/game.entity';
import { TimerService } from './timer/timer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game]),
    UsersModule,
    BetModule,
    NotificationsModule,
  ],
  providers: [
    GameManagerService,
    GameRepositoryService,
    GameEndService,
    RatingService,
    MatchmakingService,
    GameGateway,
    DisconnectionService,
    GameNotificationHelper,
    TournamentNotificationHelper,
    TimerService,
  ],
  controllers: [GameController],
  exports: [
    GameManagerService, 
    GameRepositoryService, 
    MatchmakingService,
    GameEndService,
    RatingService,
    DisconnectionService,
    GameNotificationHelper,
    TournamentNotificationHelper,
    TimerService,
  ],
})
export class GameModule {} 
