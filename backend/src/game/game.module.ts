import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { DisconnectionService } from './disconnection.service';
import { TimerModule } from './timer/timer.module';

@Module({
  imports: [TimerModule],
  providers: [MatchmakingService, DisconnectionService],
  exports: [MatchmakingService, DisconnectionService],
})
export class GameModule {} 