import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TimerModule } from './game/timer/timer.module';
import { GameModule } from './game/game.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SoundModule } from './game/sound/sound.module';
import { ClubModule } from './club/club.module';
import { ClubMemberModule } from './club-member/club-member.module';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // Only for development!
        logging: true,
      }),
      async dataSourceFactory(options) {
        const dataSource = new DataSource(options as any);
        await dataSource.initialize();
        console.log('[Nest] Connected to the database...');
        return dataSource;
      },
    }),
    FirebaseModule,
    DatabaseModule,
    UsersModule,
    TimerModule,
    GameModule,
    WebsocketModule,
    SoundModule,
    ClubModule,
    ClubMemberModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
