import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameModule } from '../game/game.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [GameModule, UsersModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class WebsocketModule {} 