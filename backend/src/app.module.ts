import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimerModule } from './game/timer/timer.module';
import { SoundModule } from './game/sound/sound.module';

@Module({
  imports: [TimerModule, SoundModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
