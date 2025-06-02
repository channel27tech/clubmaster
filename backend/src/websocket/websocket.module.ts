import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { ActivityGateway } from './activity.gateway';
import { GameModule } from '../game/game.module';
import { UsersModule } from '../users/users.module';
import { AuthGateway } from './auth.gateway';

@Module({
  imports: [GameModule, UsersModule],
  providers: [GameGateway, ActivityGateway, AuthGateway],
  exports: [GameGateway, ActivityGateway, AuthGateway],
})
export class WebsocketModule {} 