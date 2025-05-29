import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { ActivityGateway } from './activity.gateway';
import { GameModule } from '../game/game.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [GameModule, UsersModule],
  providers: [GameGateway, ActivityGateway],
  exports: [GameGateway, ActivityGateway],
})
export class WebsocketModule {} 