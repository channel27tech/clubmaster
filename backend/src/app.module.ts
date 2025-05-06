import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimerModule } from './game/timer/timer.module';
import { GameModule } from './game/game.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [TimerModule, GameModule, WebsocketModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
