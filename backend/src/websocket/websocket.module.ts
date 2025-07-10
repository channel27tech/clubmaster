import { Module } from '@nestjs/common';
import { ActivityGateway } from './activity.gateway';
import { GameModule } from '../game/game.module';
import { UsersModule } from '../users/users.module';
import { AuthGateway } from './auth.gateway';

@Module({
  imports: [GameModule, UsersModule],
  providers: [ActivityGateway, AuthGateway],
  exports: [ActivityGateway, AuthGateway],
})
export class WebsocketModule {} 