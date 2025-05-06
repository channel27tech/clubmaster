import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimerModule } from './game/timer/timer.module';
<<<<<<< HEAD
import { GameModule } from './game/game.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [TimerModule, GameModule, WebsocketModule],
=======
import { SoundModule } from './game/sound/sound.module';

@Module({
  imports: [TimerModule, SoundModule],
>>>>>>> main
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
