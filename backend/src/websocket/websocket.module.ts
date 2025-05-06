import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameModule } from '../game/game.module';

@Module({
  imports: [GameModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class WebsocketModule {} 