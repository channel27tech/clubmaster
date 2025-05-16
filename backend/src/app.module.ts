import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimerModule } from './game/timer/timer.module';
import { GameModule } from './game/game.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SoundModule } from './game/sound/sound.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [
    // Load and validate environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    FirebaseModule,
    DatabaseModule,
    UsersModule,
    TimerModule, 
    GameModule, 
    WebsocketModule, 
    SoundModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
